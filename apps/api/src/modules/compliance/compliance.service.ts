import { Injectable } from '@nestjs/common';
import { GrievanceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateGrievanceDto } from './dto/create-grievance.dto';

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async createGrievance(dto: CreateGrievanceDto) {
    return this.prisma.grievanceTicket.create({
      data: {
        userId: dto.userId,
        complainantName: dto.complainantName,
        complainantEmail: dto.complainantEmail,
        subject: dto.subject,
        description: dto.description,
        status: GrievanceStatus.received,
      },
    });
  }

  async acknowledgeGrievance(ticketId: string, officerNotes?: string) {
    return this.prisma.grievanceTicket.update({
      where: { id: ticketId },
      data: {
        status: GrievanceStatus.acknowledged,
        acknowledgedAt: new Date(),
        officerNotes,
      },
    });
  }

  async resolveGrievance(ticketId: string, officerNotes: string) {
    return this.prisma.grievanceTicket.update({
      where: { id: ticketId },
      data: {
        status: GrievanceStatus.resolved,
        resolvedAt: new Date(),
        officerNotes,
      },
    });
  }

  async listGrievances(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.grievanceTicket.findMany({
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.grievanceTicket.count(),
    ]);

    return { items, total, page, limit };
  }
}