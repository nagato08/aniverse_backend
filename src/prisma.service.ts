/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// On s'assure que le .env est chargé
dotenv.config();

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 1. Création du pool de connexion avec la lib 'pg'
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // 2. Création de l'adapter Prisma pour PostgreSQL
    const adapter = new PrismaPg(pool);

    // 3. Passage de l'adapter au constructeur parent
    super({ adapter });

    console.log('🚀 PrismaService instancié avec Driver Adapter');
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Connexion à la base de données réussie');
    } catch (error) {
      console.error('❌ Erreur de connexion DB dans onModuleInit:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
