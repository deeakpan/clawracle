// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IClawracleToken.sol";

/**
 * @title DataRequestRegistry
 * @notice Main contract for Clawracle oracle system
 * @dev Manages data requests, agent resolutions, and validation
 */
contract DataRequestRegistry {
    // ============ State Variables ============
    
    IClawracleToken public immutable token;
    uint256 public requestCounter;
    uint256 public constant DISPUTE_PERIOD = 5 minutes;      // Time to dispute initial answer
    uint256 public constant VALIDATION_PERIOD = 5 minutes;   // Time for validators if disputed
    uint256 public minBond = 500 ether; // 500 CLAWCLE minimum bond (configurable)
    address public owner;
    
    // ============ Enums ============
    
    enum AnswerFormat { Binary, MultipleChoice, SingleEntity }
    enum QueryStatus { Pending, Proposed, Disputed, Finalized }
    
    // ============ Structs ============
    
    struct OracleQuery {
        uint256 requestId;
        string ipfsCID;          // IPFS hash containing full query details
        uint256 validFrom;        // Earliest time agents can submit answers
        uint256 deadline;         // Latest time agents can submit answers
        address requester;
        string category;         // Freeform string: "sports", "weather", "crypto", etc.
        AnswerFormat expectedFormat;
        uint256 bondRequired;
        uint256 reward;          // CLAWCLE tokens paid for correct answer
        QueryStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
    }
    
    struct Answer {
        uint256 answerId;
        uint256 requestId;
        address agent;
        uint256 agentId; // ERC-8004 agent ID
        bytes answer;
        string source;
        bool isPrivateSource;
        uint256 bond;
        uint256 validations;
        uint256 disputes;
        uint256 timestamp;
        bool isOriginal;        // True if first answer (proposed), false if dispute
    }
    
    struct Validation {
        address validator;
        uint256 validatorAgentId;
        bool agree;
        string reason;
        uint256 timestamp;
    }
    
    // ============ Storage ============
    
    mapping(uint256 => OracleQuery) public queries;
    mapping(uint256 => Answer[]) public requestAnswers;
    mapping(uint256 => mapping(uint256 => Validation[])) public answerValidations;
    mapping(uint256 => mapping(address => bool)) public hasValidated;
    mapping(address => uint256) public agentBonds;
    mapping(uint256 => uint256) public winningAnswerId;
    
    // ============ Events ============
    
    event RequestSubmitted(
        uint256 indexed requestId,
        address indexed requester,
        string ipfsCID,
        string category,
        uint256 validFrom,
        uint256 deadline,
        uint256 reward,
        uint256 bondRequired
    );
    
    event AnswerProposed(
        uint256 indexed requestId,
        uint256 indexed answerId,
        address indexed agent,
        uint256 agentId,
        bytes answer,
        uint256 bond
    );
    
    event AnswerDisputed(
        uint256 indexed requestId,
        uint256 indexed answerId,
        address indexed disputer,
        uint256 disputerAgentId,
        bytes disputedAnswer,
        uint256 bond,
        uint256 originalAnswerId
    );
    
    event AnswerValidated(
        uint256 indexed requestId,
        uint256 indexed answerId,
        address indexed validator,
        bool agree
    );
    
    event RequestFinalized(
        uint256 indexed requestId,
        uint256 winningAnswerId,
        address winner,
        uint256 reward
    );
    
    event BondSlashed(
        uint256 indexed requestId,
        uint256 indexed answerId,
        address indexed agent,
        uint256 amount
    );
    
    // ============ Constructor ============
    
    constructor(address _token) {
        token = IClawracleToken(_token);
        owner = msg.sender;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Submit a new data request
     * @param ipfsCID IPFS CID containing query JSON with full details
     * @param category Freeform category string (e.g., "sports", "weather", "crypto")
     * @param validFrom Earliest time agents can submit answers (e.g., when event happens)
     * @param deadline Latest time agents can submit answers (e.g., 24hrs after event)
     * @param expectedFormat Expected format of the answer
     * @param bondRequired Minimum tokens agent must bond
     * @param reward CLAWCLE tokens paid to correct resolver
     * @return requestId The ID of the created request
     */
    function submitRequest(
        string calldata ipfsCID,
        string calldata category,
        uint256 validFrom,
        uint256 deadline,
        AnswerFormat expectedFormat,
        uint256 bondRequired,
        uint256 reward
    ) external returns (uint256 requestId) {
        require(validFrom <= deadline, "validFrom must be <= deadline");
        require(deadline > block.timestamp, "Deadline must be in future");
        require(bondRequired >= minBond, "Bond too low");
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(category).length > 0, "Category cannot be empty");
        require(reward > 0, "Reward must be > 0");
        
        // Transfer reward tokens from requester to this contract
        require(
            token.transferFrom(msg.sender, address(this), reward),
            "Reward transfer failed"
        );
        
        requestId = ++requestCounter;
        
        queries[requestId] = OracleQuery({
            requestId: requestId,
            ipfsCID: ipfsCID,
            validFrom: validFrom,
            deadline: deadline,
            requester: msg.sender,
            category: category,
            expectedFormat: expectedFormat,
            bondRequired: bondRequired,
            reward: reward,
            status: QueryStatus.Pending,
            createdAt: block.timestamp,
            resolvedAt: 0
        });
        
        emit RequestSubmitted(
            requestId,
            msg.sender,
            ipfsCID,
            category,
            validFrom,
            deadline,
            reward,
            bondRequired
        );
    }
    
    /**
     * @notice Set minimum bond requirement (only owner)
     * @param newMinBond New minimum bond amount
     */
    function setMinBond(uint256 newMinBond) external {
        require(msg.sender == owner, "Only owner");
        require(newMinBond > 0, "Min bond must be > 0");
        minBond = newMinBond;
    }
    
    /**
     * @notice Resolve a request by providing an answer (or disputing existing answer)
     * @param requestId ID of the request to resolve
     * @param agentId ERC-8004 agent ID
     * @param answer The answer data
     * @param source Source of the data (URL, API name, etc)
     * @param isPrivateSource Whether the source is private/verifiable
     */
    function resolveRequest(
        uint256 requestId,
        uint256 agentId,
        bytes calldata answer,
        string calldata source,
        bool isPrivateSource
    ) external {
        OracleQuery storage query = queries[requestId];
        
        require(query.status == QueryStatus.Pending || query.status == QueryStatus.Proposed, "Request not open");
        require(block.timestamp >= query.validFrom, "Too early to submit");
        require(block.timestamp <= query.deadline, "Deadline passed");
        require(answer.length > 0, "Answer cannot be empty");
        
        // Transfer bond from agent
        uint256 bondAmount = query.bondRequired;
        require(
            token.transferFrom(msg.sender, address(this), bondAmount),
            "Bond transfer failed"
        );
        
        agentBonds[msg.sender] += bondAmount;
        
        uint256 answerId = requestAnswers[requestId].length;
        bool isFirstAnswer = (answerId == 0);
        
        requestAnswers[requestId].push(Answer({
            answerId: answerId,
            requestId: requestId,
            agent: msg.sender,
            agentId: agentId,
            answer: answer,
            source: source,
            isPrivateSource: isPrivateSource,
            bond: bondAmount,
            validations: 0,
            disputes: 0,
            timestamp: block.timestamp,
            isOriginal: isFirstAnswer
        }));
        
        // First answer = PROPOSED (starts dispute window)
        if (isFirstAnswer) {
            query.status = QueryStatus.Proposed;
            query.resolvedAt = block.timestamp;
            
            emit AnswerProposed(
                requestId,
                answerId,
                msg.sender,
                agentId,
                answer,
                bondAmount
            );
        } else {
            // Subsequent answers = disputes
            query.status = QueryStatus.Disputed;
            
            emit AnswerDisputed(
                requestId,
                answerId,
                msg.sender,
                agentId,
                answer,
                bondAmount,
                0 // originalAnswerId (first answer is always 0)
            );
        }
    }
    
    /**
     * @notice Validate an answer submitted by another agent
     * @dev Only callable when request is DISPUTED
     * @param requestId ID of the request
     * @param answerId ID of the answer to validate
     * @param validatorAgentId ERC-8004 agent ID of validator
     * @param agree Whether validator agrees with the answer
     * @param reason Optional reason for validation/dispute
     */
    function validateAnswer(
        uint256 requestId,
        uint256 answerId,
        uint256 validatorAgentId,
        bool agree,
        string calldata reason
    ) external {
        OracleQuery storage query = queries[requestId];
        
        require(query.status == QueryStatus.Disputed, "Request not disputed");
        require(
            block.timestamp <= query.resolvedAt + DISPUTE_PERIOD + VALIDATION_PERIOD,
            "Validation period ended"
        );
        require(!hasValidated[requestId][msg.sender], "Already validated");
        require(answerId < requestAnswers[requestId].length, "Invalid answer ID");
        
        // Prevent self-validation
        Answer storage answer = requestAnswers[requestId][answerId];
        require(answer.agent != msg.sender, "Cannot validate own answer");
        
        hasValidated[requestId][msg.sender] = true;
        
        answerValidations[requestId][answerId].push(Validation({
            validator: msg.sender,
            validatorAgentId: validatorAgentId,
            agree: agree,
            reason: reason,
            timestamp: block.timestamp
        }));
        
        if (agree) {
            answer.validations++;
        } else {
            answer.disputes++;
        }
        
        emit AnswerValidated(requestId, answerId, msg.sender, agree);
    }
    
    /**
     * @notice Finalize a request after dispute/validation period
     * @dev Handles both undisputed (auto-win) and disputed (validation-based) cases
     * @param requestId ID of the request to finalize
     */
    function finalizeRequest(uint256 requestId) external {
        OracleQuery storage query = queries[requestId];
        
        require(
            query.status == QueryStatus.Proposed || query.status == QueryStatus.Disputed,
            "Request not resolved"
        );
        require(query.status != QueryStatus.Finalized, "Already finalized");
        
        Answer[] storage answers = requestAnswers[requestId];
        require(answers.length > 0, "No answers submitted");
        
        uint256 winnerId;
        
        // CASE 1: PROPOSED (no disputes) - First answer wins automatically
        if (query.status == QueryStatus.Proposed) {
            require(
                block.timestamp > query.resolvedAt + DISPUTE_PERIOD,
                "Dispute period not ended"
            );
            
            // Original answer wins by default
            winnerId = 0;
        }
        // CASE 2: DISPUTED - Need validation results
        else if (query.status == QueryStatus.Disputed) {
            require(
                block.timestamp > query.resolvedAt + DISPUTE_PERIOD + VALIDATION_PERIOD,
                "Validation period not ended"
            );
            
            // Find answer with most validations
            uint256 maxValidations = 0;
            
            for (uint256 i = 0; i < answers.length; i++) {
                if (answers[i].validations > maxValidations) {
                    maxValidations = answers[i].validations;
                    winnerId = i;
                }
            }
            
            // Handle tie: first answer with max validations wins
            // (already set by loop above)
        }
        
        query.status = QueryStatus.Finalized;
        winningAnswerId[requestId] = winnerId;
        
        // Reward winning agent
        Answer storage winningAnswer = answers[winnerId];
        address winner = winningAnswer.agent;
        
        // Return bond + reward
        uint256 totalPayout = winningAnswer.bond + query.reward;
        agentBonds[winner] -= winningAnswer.bond;
        
        require(token.transfer(winner, totalPayout), "Reward transfer failed");
        
        // Slash bonds of incorrect answers
        for (uint256 i = 0; i < answers.length; i++) {
            if (i != winnerId) {
                // Calculate slash amount (50% of bond)
                uint256 slashAmount = answers[i].bond / 2;
                agentBonds[answers[i].agent] -= answers[i].bond;
                
                emit BondSlashed(requestId, i, answers[i].agent, slashAmount);
                
                // Remaining 50% of bond goes to contract (treasury)
            }
        }
        
        emit RequestFinalized(requestId, winnerId, winner, query.reward);
    }
    
    // ============ View Functions ============
    
    function getQuery(uint256 requestId) external view returns (OracleQuery memory) {
        return queries[requestId];
    }
    
    function getAnswerIdForAgent(uint256 requestId, address agent) external view returns (int256) {
        Answer[] memory answers = requestAnswers[requestId];
        for (uint256 i = 0; i < answers.length; i++) {
            if (answers[i].agent == agent) {
                return int256(i);
            }
        }
        return -1; // Agent hasn't submitted an answer
    }
    
    function getAnswers(uint256 requestId) external view returns (Answer[] memory) {
        return requestAnswers[requestId];
    }
    
    function getValidations(uint256 requestId, uint256 answerId) 
        external 
        view 
        returns (Validation[] memory) 
    {
        return answerValidations[requestId][answerId];
    }
    
    function getPendingRequests() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= requestCounter; i++) {
            if (queries[i].status == QueryStatus.Pending) {
                count++;
            }
        }
        
        uint256[] memory pending = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= requestCounter; i++) {
            if (queries[i].status == QueryStatus.Pending) {
                pending[index++] = i;
            }
        }
        
        return pending;
    }
}
