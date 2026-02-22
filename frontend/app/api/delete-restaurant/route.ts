import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { restaurantId } = await req.json();

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'restaurantId is required' },
        { status: 400 }
      );
    }

    const dataDir = path.join(process.cwd(), 'public', 'data');
    const restaurantDir = path.join(dataDir, restaurantId);
    const restaurantsFile = path.join(dataDir, 'restaurants.json');

    // Read and update restaurants.json
    const restaurantsJson = await fs.readFile(restaurantsFile, 'utf-8');
    let restaurants = JSON.parse(restaurantsJson) as string[];

    restaurants = restaurants.filter(id => id !== restaurantId);

    await fs.writeFile(restaurantsFile, JSON.stringify(restaurants, null, 2));

    // Delete the restaurant folder
    await fs.rm(restaurantDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: `Restaurant "${restaurantId}" deleted successfully`,
    });
  } catch (error) {
    console.error('Delete restaurant error:', error);
    return NextResponse.json(
      { error: 'Failed to delete restaurant' },
      { status: 500 }
    );
  }
}