'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { parseEther, formatEther } from 'viem'
import Image from 'next/image'

// Format balance to reasonable decimal places (removes long decimals)
function formatBalance(value, decimals = 2) {
  if (!value) return '0'
  try {
    const num = typeof value === 'bigint' ? Number(formatEther(value)) : Number(value)
    if (isNaN(num) || !isFinite(num)) return '0'
    // Round to specified decimals and remove trailing zeros
    const formatted = num.toFixed(decimals)
    return formatted.replace(/\.?0+$/, '')
  } catch (e) {
    return '0'
  }
}

export default function Home() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [ipfsCID, setIpfsCID] = useState('')
  
  // Form state
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Weather')
  const [reward, setReward] = useState('500')
  const [bondRequired, setBondRequired] = useState('500')
  
  // Contract addresses (Monad Mainnet)
  const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_CLAWRACLE_REGISTRY || '0x1F68C6D1bBfEEc09eF658B962F24278817722E18'
  const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_CLAWRACLE_TOKEN || '0x99FB9610eC9Ff445F990750A7791dB2c1F5d7777'

  // Token ABI
  const tokenABI = [
    {
      inputs: [{ name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      name: 'approve',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ]

  // Registry ABI
  const registryABI = [
    {
      inputs: [
        { name: 'ipfsCID', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'validFrom', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'expectedFormat', type: 'uint8' },
        { name: 'bondRequired', type: 'uint256' },
        { name: 'reward', type: 'uint256' }
      ],
      name: 'submitRequest',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
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

  // Read CLAWCLE balance
  const { data: balance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: tokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!TOKEN_ADDRESS }
  })

  // Approve bond
  const { writeContract: approveContract, data: approveHash, isPending: isApproving } = useWriteContract()
  const { isLoading: isWaitingApprove, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  // Submit request
  const { writeContract: submitContract, data: submitHash, isPending: isSubmitting, error: submitError } = useWriteContract()
  const { isLoading: isWaitingSubmit, isSuccess: isSubmitSuccess, isError: isSubmitTxError } = useWaitForTransactionReceipt({ hash: submitHash })

  const submitRequest = async () => {
    if (!isConnected || !query || !walletClient) {
      alert('Please connect wallet and enter query')
      return
    }

    setLoading(true)
    setUploadSuccess(false)
    setSuccessMessage('')
    
    try {
      // 1. Upload to Lighthouse IPFS via API route
      const queryData = {
        query: query,
        category: category,
        expectedFormat: 'SingleEntity'
      }
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify(queryData) })
      })
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Failed to upload to IPFS')
      }
      
      const uploadData = await uploadResponse.json()
      const cid = uploadData.cid
      setIpfsCID(cid)
      setUploadSuccess(true)
      setSuccessMessage('Query uploaded to IPFS successfully!')

      // 2. Approve tokens - this will prompt user
      const totalNeeded = parseEther(reward)
      approveContract({
        address: TOKEN_ADDRESS,
        abi: tokenABI,
        functionName: 'approve',
        args: [REGISTRY_ADDRESS, totalNeeded]
      })
    } catch (error) {
      console.error('Error uploading to IPFS:', error)
      alert('Error: ' + error.message)
      setLoading(false)
    }
  }

  // Handle approval success - then submit to contract
  useEffect(() => {
    if (isApproveSuccess && approveHash && loading && ipfsCID) {
      try {
        // Submit to contract after approval succeeds
        const now = Math.floor(Date.now() / 1000)
        const validFrom = BigInt(now + 180)
        const deadline = BigInt(now + 86400)

          submitContract({
            address: REGISTRY_ADDRESS,
            abi: registryABI,
            functionName: 'submitRequest',
            args: [ipfsCID, category, validFrom, deadline, 2, parseEther(bondRequired), parseEther(reward)]
          })
      } catch (error) {
        console.error('Error submitting to contract:', error)
        alert('Error submitting request: ' + error.message)
        setLoading(false)
      }
    }
  }, [isApproveSuccess, approveHash, loading, ipfsCID, REGISTRY_ADDRESS, category, bondRequired, reward, submitContract])

  // Handle submit success
  useEffect(() => {
    if (isSubmitSuccess && submitHash) {
      setSuccessMessage('Request submitted successfully!')
      setQuery('')
      // Reload requests after a short delay to allow blockchain to update
      setTimeout(() => {
        loadRequests()
        setLoading(false)
        setUploadSuccess(false)
        setSuccessMessage('')
      }, 3000)
    }
  }, [isSubmitSuccess, submitHash])

  // Handle submit error
  useEffect(() => {
    if (isSubmitTxError || submitError) {
      console.error('Submit transaction error:', submitError)
      alert('Transaction failed: ' + (submitError?.message || 'Unknown error. Please check your balance and try again.'))
      setLoading(false)
      setUploadSuccess(false)
      setSuccessMessage('')
    }
  }, [isSubmitTxError, submitError])

  const loadRequests = async () => {
    console.log('loadRequests called')
    
    setLoadingRequests(true)
    try {
      // Fetch requests from API route
      const response = await fetch('/api/requests')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch requests')
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch requests')
      }

      console.log('Fetched', data.requests.length, 'requests from API')
      setRequests(data.requests || [])
    } catch (error) {
      console.error('Error loading requests:', error)
      setRequests([])
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    // Load requests regardless of wallet connection (public data)
    loadRequests()
  }, [submitHash, approveHash])

  const getStatusBadge = (status) => {
    const statusMap = {
      0: { label: 'Pending', icon: Clock, color: 'bg-slate-100 text-slate-700' },
      1: { label: 'Proposed', icon: CheckCircle, color: 'bg-purple-100 text-purple-700' },
      2: { label: 'Disputed', icon: AlertCircle, color: 'bg-amber-100 text-amber-700' },
      3: { label: 'Finalized', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' }
    }
    
    const statusInfo = statusMap[status] || statusMap[0]
    const Icon = statusInfo.icon
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {statusInfo.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-12 border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/logo.png"
                alt="Clawracle Logo"
                width={48}
                height={48}
                className="rounded-full"
              />
              <h1 className="text-3xl font-bold text-black tracking-tight">Clawracle</h1>
            </div>
            <ConnectButton />
          </div>
        </header>

        {/* Wallet Info */}
        {isConnected && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6 mb-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Connected Wallet</p>
                <p className="text-base font-mono text-black">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
              </div>
              {balance !== undefined && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600 mb-1">CLAWCLE Balance</p>
                  <p className="text-2xl font-bold text-purple-600">{formatBalance(balance)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Request Form */}
        {isConnected && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-2xl font-bold text-black mb-6">Submit Data Request</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Query</label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What is the current weather in New York?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option>Weather</option>
                    <option>Sports</option>
                    <option>Politics</option>
                    <option>Market</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Reward (CLAWCLE)</label>
                  <input
                    type="number"
                    min="500"
                    value={reward}
                    onChange={(e) => setReward(e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
                  />
                  {balance !== undefined && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      Your balance: <span className="font-medium text-gray-700">{formatBalance(balance)} CLAWCLE</span>
                    </p>
                  )}
                  {reward && reward !== '' && (isNaN(parseFloat(reward)) || parseFloat(reward) < 500) && (
                    <p className="text-xs text-red-500 mt-1">Minimum reward is 500 CLAWCLE</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bond Required (CLAWCLE)</label>
                  <input
                    type="number"
                    min="500"
                    value={bondRequired}
                    onChange={(e) => setBondRequired(e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
                  />
                  {bondRequired && bondRequired !== '' && (isNaN(parseFloat(bondRequired)) || parseFloat(bondRequired) < 500) && (
                    <p className="text-xs text-red-500 mt-1">Minimum bond is 500 CLAWCLE</p>
                  )}
                </div>
              </div>

              {/* Success Message */}
              {(uploadSuccess || successMessage) && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">{successMessage || 'Query uploaded to IPFS successfully!'}</p>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={submitRequest}
                  disabled={loading || !query || !reward || !bondRequired || isNaN(parseFloat(reward)) || isNaN(parseFloat(bondRequired)) || parseFloat(reward) < 500 || parseFloat(bondRequired) < 500 || isApproving || isWaitingApprove || isSubmitting || isWaitingSubmit}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {loading || isApproving || isWaitingApprove || isSubmitting || isWaitingSubmit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isApproving || isWaitingApprove ? 'Approving...' : isSubmitting || isWaitingSubmit ? 'Submitting...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Requests List */}
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-black">Data Requests</h2>
            {isConnected && (
              <button
                onClick={() => {
                  console.log('Manual refresh clicked')
                  loadRequests()
                }}
                disabled={loadingRequests}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
              >
                {loadingRequests ? 'Loading...' : 'Refresh'}
              </button>
            )}
          </div>
          
          {!isConnected ? (
            <div className="text-center py-12 text-slate-500">
              <p>Connect wallet to view requests</p>
            </div>
          ) : loadingRequests ? (
            <div className="text-center py-12 text-slate-500">
              <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mb-2"></div>
              <p>Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">Request #{request.id}</span>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-slate-600">{request.query?.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{request.query?.reward ? formatBalance(request.query.reward) : '0'} CLAWCLE</p>
                      <p className="text-xs text-slate-500">Reward</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-sm font-medium text-slate-700 mb-2">Query:</p>
                    <p className="text-sm text-slate-900 mb-3">{request.queryText || 'Loading...'}</p>
                    
                    {request.answers && request.answers.length > 0 ? (
                      <>
                        <p className="text-sm font-medium text-slate-700 mb-2">Answers ({request.answers.length}):</p>
                        <div className="space-y-2">
                          {request.answers.map((answer, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-lg p-3">
                              <div className="flex items-start justify-between mb-1">
                                <p className="text-sm font-medium text-slate-900">{answer.text}</p>
                                {answer.isOriginal && (
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Original</span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-600 mt-2">
                                <span>Agent: {answer.agent?.slice(0, 6)}...{answer.agent?.slice(-4)}</span>
                                <span>{answer.validations} validations</span>
                                {answer.disputes > 0 && (
                                  <span className="text-amber-700">{answer.disputes} disputes</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No answers submitted yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
