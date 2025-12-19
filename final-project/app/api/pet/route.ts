import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PetService } from '@/lib/services/pet.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const petService = new PetService();

// GET - 獲取寵物狀態
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    let pet;
    try {
      pet = await petService.getOrCreatePet(session.user.id);
    } catch (petError) {
      logger.error('Error in getOrCreatePet', petError as Error);
      console.error('getOrCreatePet error:', petError);
      return NextResponse.json({ 
        error: '無法創建或獲取寵物',
        details: petError instanceof Error ? petError.message : 'Unknown error'
      }, { status: 500 });
    }

    if (!pet) {
      logger.error('Failed to get or create pet', undefined, { userId: session.user.id });
      return NextResponse.json({ error: '無法創建或獲取寵物' }, { status: 500 });
    }

    // 確保所有必要的欄位都存在
    const petData = {
      _id: pet._id.toString(),
      name: pet.name || '記帳小雞',
      stage: pet.stage || 'egg',
      state: pet.state || 'idle',
      hunger: pet.hunger ?? 50,
      happiness: pet.happiness ?? 50,
      health: pet.health ?? 100,
      experience: pet.experience ?? 0,
      level: pet.level ?? 1,
      consecutiveDays: pet.consecutiveDays ?? 0,
      totalTransactions: pet.totalTransactions ?? 0,
      evolutionType: pet.evolutionType,
      statusMessage: petService.getPetStatusMessage(pet),
      lastFedAt: pet.lastFedAt || new Date(),
    };

    return NextResponse.json(petData);
  } catch (error) {
    logger.error('Error fetching pet', error as Error);
    console.error('Pet API error details:', error);
    return NextResponse.json({ 
      error: '查詢失敗',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// PUT - 更新寵物名稱
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { name } = body;

    const pet = await petService.getOrCreatePet(session.user.id);
    if (name) {
      pet.name = name;
      await pet.save();
    }

    return NextResponse.json({
      _id: pet._id.toString(),
      name: pet.name,
      stage: pet.stage,
      state: pet.state,
      hunger: pet.hunger,
      happiness: pet.happiness,
      health: pet.health,
      experience: pet.experience,
      level: pet.level,
      consecutiveDays: pet.consecutiveDays,
      totalTransactions: pet.totalTransactions,
      evolutionType: pet.evolutionType,
      statusMessage: petService.getPetStatusMessage(pet),
    });
  } catch (error) {
    logger.error('Error updating pet', error as Error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

