require('dotenv/config');

const { randomUUID } = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const accessTtlSeconds = Number(process.env.JWT_ACCESS_TTL || 900);
  const email = process.env.DEV_AUTH_EMAIL || 'dev@diagent.local';
  const deviceId = process.env.TEST_DEVICE_ID || 'ios-sim-001';

  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  if (!accessSecret) {
    throw new Error('JWT_ACCESS_SECRET is required');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const passwordHash = await argon2.hash(randomUUID());
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        firstName: 'Dev',
        lastName: 'Token',
      },
      create: {
        email,
        passwordHash,
        firstName: 'Dev',
        lastName: 'Token',
      },
    });

    await prisma.device.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId,
        },
      },
      update: {
        lastSeenAt: new Date(),
        name: 'Dev iOS Simulator',
      },
      create: {
        userId: user.id,
        deviceId,
        platform: 'ios',
        name: 'Dev iOS Simulator',
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      deviceId,
      sessionId: randomUUID(),
    };

    const accessToken = jwt.sign(payload, accessSecret, {
      expiresIn: accessTtlSeconds,
    });

    const expiresAt = new Date(Date.now() + accessTtlSeconds * 1000);

    console.log(
      JSON.stringify(
        {
          accessToken,
          expiresAt: expiresAt.toISOString(),
          user: {
            id: user.id,
            email: user.email,
          },
          deviceId,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
