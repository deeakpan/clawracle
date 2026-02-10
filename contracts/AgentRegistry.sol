// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentRegistry
 * @notice Simplified registry for Clawracle agents
 * @dev Maps agent addresses to their ERC-8004 IDs and metadata
 */
contract AgentRegistry {
    struct Agent {
        address agentAddress;
        uint256 erc8004AgentId; // Their ID on ERC-8004 mainnet
        string name;
        string endpoint;
        uint256 reputationScore;
        uint256 totalResolutions;
        uint256 correctResolutions;
        uint256 totalValidations;
        bool isActive;
        uint256 registeredAt;
    }
    
    mapping(address => Agent) public agents;
    mapping(uint256 => address) public agentIdToAddress;
    address[] public registeredAgents;
    
    event AgentRegistered(
        address indexed agentAddress,
        uint256 indexed erc8004AgentId,
        string name
    );
    
    event ReputationUpdated(
        address indexed agentAddress,
        uint256 newScore
    );
    
    /**
     * @notice Register a new agent
     * @param erc8004AgentId The agent's ERC-8004 ID on mainnet
     * @param name Agent name
     * @param endpoint Agent API endpoint
     */
    function registerAgent(
        uint256 erc8004AgentId,
        string calldata name,
        string calldata endpoint
    ) external {
        require(agents[msg.sender].agentAddress == address(0), "Already registered");
        require(erc8004AgentId > 0, "Invalid agent ID");
        
        agents[msg.sender] = Agent({
            agentAddress: msg.sender,
            erc8004AgentId: erc8004AgentId,
            name: name,
            endpoint: endpoint,
            reputationScore: 100, // Start with base score
            totalResolutions: 0,
            correctResolutions: 0,
            totalValidations: 0,
            isActive: true,
            registeredAt: block.timestamp
        });
        
        agentIdToAddress[erc8004AgentId] = msg.sender;
        registeredAgents.push(msg.sender);
        
        emit AgentRegistered(msg.sender, erc8004AgentId, name);
    }
    
    /**
     * @notice Update agent reputation after resolution
     * @param agentAddress Address of the agent
     * @param wasCorrect Whether their answer was correct
     */
    function updateReputation(address agentAddress, bool wasCorrect) external {
        Agent storage agent = agents[agentAddress];
        require(agent.isActive, "Agent not active");
        
        agent.totalResolutions++;
        
        if (wasCorrect) {
            agent.correctResolutions++;
            agent.reputationScore += 10; // Increase on correct answer
        } else {
            if (agent.reputationScore >= 20) {
                agent.reputationScore -= 20; // Decrease on wrong answer
            } else {
                agent.reputationScore = 0;
            }
        }
        
        emit ReputationUpdated(agentAddress, agent.reputationScore);
    }
    
    /**
     * @notice Record a validation by an agent
     * @param agentAddress Address of the validating agent
     */
    function recordValidation(address agentAddress) external {
        Agent storage agent = agents[agentAddress];
        require(agent.isActive, "Agent not active");
        
        agent.totalValidations++;
        agent.reputationScore += 1; // Small reputation boost for participating in validation
        
        emit ReputationUpdated(agentAddress, agent.reputationScore);
    }
    
    /**
     * @notice Get agent details
     */
    function getAgent(address agentAddress) external view returns (Agent memory) {
        return agents[agentAddress];
    }
    
    /**
     * @notice Get all registered agents
     */
    function getAllAgents() external view returns (address[] memory) {
        return registeredAgents;
    }
    
    /**
     * @notice Get agent success rate
     */
    function getSuccessRate(address agentAddress) external view returns (uint256) {
        Agent storage agent = agents[agentAddress];
        if (agent.totalResolutions == 0) return 0;
        return (agent.correctResolutions * 100) / agent.totalResolutions;
    }
}
