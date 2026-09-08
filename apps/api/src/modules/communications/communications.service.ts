import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateCommunicationSettingsDto } from './dto/update-communication-settings.dto';
import {
  defaultCommunicationSettings,
  serializeCommunicationSettings,
  settingsWritePayload,
} from './utils/communication-settings.util';

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string) {
    const row = await this.prisma.communicationSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return serializeCommunicationSettings(row);
  }

  async updateSettings(userId: string, dto: UpdateCommunicationSettingsDto) {
    const payload = settingsWritePayload(dto);
    const row = await this.prisma.communicationSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...payload,
      },
      update: payload,
    });
    return serializeCommunicationSettings(row);
  }

  async getSettingsForUser(userId: string) {
    const row = await this.prisma.communicationSettings.findUnique({
      where: { userId },
    });
    return serializeCommunicationSettings(row ?? defaultCommunicationSettings());
  }
}