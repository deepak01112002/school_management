import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AttendanceService } from './attendance.service';
import { MarkSectionAttendanceDto } from './dto/mark-section-attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth('JWT')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sections/:sectionId')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Get section attendance roster for a date' })
  getSectionAttendance(
    @TenantId() tenantId: string,
    @Param('sectionId') sectionId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getSectionAttendance(tenantId, sectionId, date);
  }

  @Post('sections/:sectionId')
  @RequirePermissions('attendance:create')
  @ApiOperation({ summary: 'Mark section attendance for a date' })
  markSectionAttendance(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('sectionId') sectionId: string,
    @Body() dto: MarkSectionAttendanceDto,
  ) {
    return this.attendanceService.markSectionAttendance(tenantId, user, sectionId, dto);
  }

  @Get('me')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Get logged-in student attendance summary' })
  getMyAttendance(@TenantId() tenantId: string, @CurrentUser() user: AuthUser) {
    return this.attendanceService.getMyAttendance(tenantId, user.id);
  }
}
