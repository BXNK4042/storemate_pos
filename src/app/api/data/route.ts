let barcode = 'No data';

export async function POST(req: Request) {
  const body = await req.json();
  barcode = body.text;
  return Response.json({ success: true });
}

export async function GET() {
  return Response.json({ text: barcode });
}

export async function DELETE() {
  barcode = '';
  return Response.json({ success: true})
}
