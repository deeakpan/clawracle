import { NextResponse } from 'next/server'
import lighthouse from '@lighthouse-web3/sdk'

// Runtime configuration
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const { text } = body
    
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
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to upload to IPFS' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// GET handler for debugging
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST method to upload data' },
    { status: 405 }
  )
}
