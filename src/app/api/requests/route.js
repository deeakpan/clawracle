import { NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Contract ABI (only the functions we need)
const REGISTRY_ABI = [
  {
    inputs: [],
    name: 'requestCounter',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'requestId', type: 'uint256' }],
    name: 'getQuery',
    outputs: [{
      components: [
        { name: 'requestId', type: 'uint256' },
        { name: 'ipfsCID', type: 'string' },
        { name: 'validFrom', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'requester', type: 'address' },
        { name: 'category', type: 'string' },
        { name: 'expectedFormat', type: 'uint8' },
        { name: 'bondRequired', type: 'uint256' },
        { name: 'reward', type: 'uint256' },
        { name: 'status', type: 'uint8' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'resolvedAt', type: 'uint256' }
      ],
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'requestId', type: 'uint256' }],
    name: 'getAnswers',
    outputs: [{
      components: [
        { name: 'answerId', type: 'uint256' },
        { name: 'requestId', type: 'uint256' },
        { name: 'agent', type: 'address' },
        { name: 'agentId', type: 'uint256' },
        { name: 'answer', type: 'bytes' },
        { name: 'source', type: 'string' },
        { name: 'isPrivateSource', type: 'bool' },
        { name: 'bond', type: 'uint256' },
        { name: 'validations', type: 'uint256' },
        { name: 'disputes', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'isOriginal', type: 'bool' }
      ],
      name: '',
      type: 'tuple[]'
    }],
    stateMutability: 'view',
    type: 'function',
  },
]

// Monad Mainnet RPC
const RPC_URL = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz'
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_CLAWRACLE_REGISTRY || '0x1F68C6D1bBfEEc09eF658B962F24278817722E18'

export async function GET(request) {
  try {
    console.log('Fetching requests from contract:', REGISTRY_ADDRESS)
    console.log('Using RPC:', RPC_URL)

    // Connect to Monad RPC
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider)

    // Get request counter
    const requestCounter = await registry.requestCounter()
    const totalRequests = Number(requestCounter || 0n)
    
    console.log('Total requests found:', totalRequests)

    if (totalRequests === 0) {
      return NextResponse.json({
        success: true,
        requests: [],
        total: 0
      })
    }

    // Fetch all requests
    const requests = []
    
    for (let i = 1; i <= totalRequests; i++) {
      try {
        console.log(`Fetching request ${i}/${totalRequests}...`)
        
        // Get query data
        const queryData = await registry.getQuery(i)
        
        // Fetch IPFS content
        let queryText = 'Loading...'
        try {
          const ipfsResponse = await fetch(`https://ipfs.io/ipfs/${queryData.ipfsCID}`, {
            headers: {
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
          })
          
          if (ipfsResponse.ok) {
            const ipfsData = await ipfsResponse.json()
            queryText = typeof ipfsData === 'string' ? ipfsData : ipfsData.query || JSON.stringify(ipfsData)
          } else {
            queryText = `Error fetching IPFS: ${ipfsResponse.statusText}`
          }
        } catch (ipfsError) {
          console.error(`IPFS error for request ${i}:`, ipfsError.message)
          queryText = `Error fetching IPFS: ${ipfsError.message}`
        }

        // Get answers
        const answersData = await registry.getAnswers(i)

        requests.push({
          id: Number(queryData.requestId),
          query: {
            requestId: Number(queryData.requestId),
            ipfsCID: queryData.ipfsCID,
            validFrom: queryData.validFrom.toString(),
            deadline: queryData.deadline.toString(),
            requester: queryData.requester,
            category: queryData.category,
            expectedFormat: Number(queryData.expectedFormat),
            bondRequired: queryData.bondRequired.toString(),
            reward: queryData.reward.toString(),
            status: Number(queryData.status),
            createdAt: queryData.createdAt.toString(),
            resolvedAt: queryData.resolvedAt.toString(),
          },
          queryText: queryText,
          answers: answersData.map(answer => ({
            answerId: Number(answer.answerId),
            requestId: Number(answer.requestId),
            agent: answer.agent,
            agentId: Number(answer.agentId),
            text: ethers.toUtf8String(answer.answer),
            source: answer.source,
            isPrivateSource: answer.isPrivateSource,
            bond: answer.bond.toString(),
            validations: Number(answer.validations),
            disputes: Number(answer.disputes),
            timestamp: answer.timestamp.toString(),
            isOriginal: answer.isOriginal,
          })),
          status: Number(queryData.status),
        })
      } catch (error) {
        console.error(`Error fetching request ${i}:`, error.message)
        // Continue with other requests
      }
    }

    console.log(`Successfully fetched ${requests.length} requests`)
    
    // Return requests in reverse order (most recent first)
    return NextResponse.json({
      success: true,
      requests: requests.reverse(),
      total: totalRequests
    })
  } catch (error) {
    console.error('Error fetching requests:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch requests',
        details: error.stack
      },
      { status: 500 }
    )
  }
}
