import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Reports which services are configured. Useful for verifying
 * environment setup before a demo or after deployment.
 */
export async function GET() {
  const services = {
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
    neo4j: !!(process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD),
    blobStorage: !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.Audio_READ_WRITE_TOKEN),
  };

  const configured = Object.entries(services)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const missing = Object.entries(services)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return NextResponse.json({
    status: 'ok',
    configured,
    missing,
    capabilities: {
      photoAnalysis: services.gemini || services.openai || services.anthropic,
      transcription: services.openai,
      projectSearch: services.anthropic,
      graphSearch: services.openai && services.neo4j,
      graphIngest: services.neo4j,
      largeAudioUpload: services.blobStorage,
    },
  });
}
