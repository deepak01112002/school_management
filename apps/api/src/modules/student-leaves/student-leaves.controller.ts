import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CreateStudentLeaveDto } from './dto/create-student-leave.dto';
import { ReviewStudentLeaveDto } from './dto/review-student-leave.dto';
import { StudentLeavesService } from './student-leaves.service';

@ApiTags('student-leaves')
@ApiBearerAuth('JWT')
@Controller('student-leaves')
export class StudentLeavesController {
  constructor(private readonly studentLeavesService: StudentLeavesService) {}

  @Get('me')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'List logged-in student leave applications' })
  listMine(@TenantId() tenantId: string, @CurrentUser() user: AuthUser) {
    return this.studentLeavesService.listMine(tenantId, user.id);
  }

  @Post('me')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Apply leave as logged-in student' })
  createMine(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStudentLeaveDto,
  ) {
    return this.studentLeavesService.createMine(tenantId, user.id, dto);
  }

  @Get()
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'List student leave applications for review' })
  listForReview(@TenantId() tenantId: string) {
    return this.studentLeavesService.listForReview(tenantId);
  }

  @Patch(':id/approve')
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Approve student leave application' })
  approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewStudentLeaveDto,
  ) {
    return this.studentLeavesService.review(tenantId, user, id, 'APPROVED', dto);
  }

  @Patch(':id/reject')
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Reject student leave application' })
  reject(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewStudentLeaveDto,
  ) {
    return this.studentLeavesService.review(tenantId, user, id, 'REJECTED', dto);
  }
}
