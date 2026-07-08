import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { isInternalRequest } from '@/lib/api-guards';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const collectionName = searchParams.get('collection');
    const id = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '500');
    
    // Filtering parameters
    const whereField = searchParams.get('whereField');
    const whereOperator = searchParams.get('whereOperator') || '==';
    const whereValue = searchParams.get('whereValue');
    
    if (!collectionName) {
      return NextResponse.json({ success: false, error: 'Collection name is required' }, { status: 400 });
    }

    console.log(`[API GENERIC] GET ${collectionName} - id: ${id}, where: ${whereField} ${whereOperator} ${whereValue}`);

    if (id) {
      const data = await FirebaseDatabaseService.getDocument(collectionName, id);
      return NextResponse.json({ success: true, data });
    }

    if (whereField && whereValue) {
      // If whereValue looks like a boolean or number, parse it
      let parsedValue: any = whereValue;
      if (whereValue === 'true') parsedValue = true;
      else if (whereValue === 'false') parsedValue = false;
      else if (!isNaN(Number(whereValue)) && whereValue.trim() !== '') parsedValue = Number(whereValue);

      if (whereOperator === 'in' || whereOperator === 'array-contains-any') {
        parsedValue = (whereValue as string).split(',');
      }

      const data = await FirebaseDatabaseService.getCollectionWhere(collectionName, whereField, whereOperator, parsedValue);
      return NextResponse.json({ success: true, data });
    }

    const data = await FirebaseDatabaseService.getCollection(collectionName, limit);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error(`[API] Error fetching data:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const collectionName = searchParams.get('collection');
    const id = searchParams.get('id');
    const body = await request.json();

    if (!collectionName) {
      return NextResponse.json({ success: false, error: 'Collection name is required' }, { status: 400 });
    }

    if (id) {
      const data = await FirebaseDatabaseService.createDocument(collectionName, id, body);
      return NextResponse.json({ success: true, data });
    } else {
      const result = await FirebaseDatabaseService.addDocument(collectionName, body);
      return NextResponse.json(result);
    }
  } catch (error: any) {
    console.error(`[API] Error creating data:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const collectionName = searchParams.get('collection');
    const id = searchParams.get('id');
    const body = await request.json();

    if (!collectionName || !id) {
      return NextResponse.json({ success: false, error: 'Collection name and ID are required' }, { status: 400 });
    }

    const result = await FirebaseDatabaseService.updateDocument(collectionName, id, body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[API] Error updating data:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const collectionName = searchParams.get('collection');
    const id = searchParams.get('id');

    if (!collectionName || !id) {
      return NextResponse.json({ success: false, error: 'Collection name and ID are required' }, { status: 400 });
    }

    const result = await FirebaseDatabaseService.deleteDocument(collectionName, id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[API] Error deleting data:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
