import { NextResponse } from 'next/server'
import lighthouse from '@lighthouse-web3/sdk'

export async function POST(request) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text content is required' },
        { status: 400 }
      )
    }

    const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY
    
    if (!lighthouseApiKey) {
      return NextResponse.json(
        { error: 'Lighthouse API key not configured' },
        { status: 500 }
      )
    }

    // Upload to Lighthouse IPFS
    const uploadResponse = await lighthouse.uploadText(
      text,
      lighthouseApiKey
    )

    if (!uploadResponse.data || !uploadResponse.data.Hash) {
      return NextResponse.json(
        { error: 'Invalid response from Lighthouse' },
        { status: 500 }
      )
    }

    const ipfsCID = uploadResponse.data.Hash

    return NextResponse.json({
      success: true,
      cid: ipfsCID,
      ipfsURI: `ipfs://${ipfsCID}`,
      gatewayURL: `https://ipfs.io/ipfs/${ipfsCID}`
    })
  } catch (error) {
    console.error('Lighthouse upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload to IPFS' },
      { status: 500 }
    )
  }
}
