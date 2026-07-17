import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { StaffService } from './staff.service';

@ApiTags('staff')
@ApiBearerAuth('JWT')
@Controller()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('teachers')
  @RequirePermissions('staff:read')
  @ApiOperation({ summary: 'List teachers' })
  listTeachers(@TenantId() tenantId: string) {
    return this.staffService.listTeachers(tenantId);
  }

  @Post('teachers')
  @RequirePermissions('staff:create')
  @ApiOperation({ summary: 'Create teacher login and staff profile' })
  createTeacher(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTeacherDto,
  ) {
    return this.staffService.createTeacher(tenantId, user.id, dto);
  }

  @Patch('sections/:id/class-teacher')
  @RequirePermissions('academic:update')
  @ApiOperation({ summary: 'Assign class teacher to a section' })
  assignClassTeacher(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') sectionId: string,
    @Body() dto: AssignClassTeacherDto,
  ) {
    return this.staffService.assignClassTeacher(tenantId, user.id, sectionId, dto.staffId);
  }

  @Get('teachers/me/sections')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'List sections assigned to the logged-in teacher' })
  getMySections(@TenantId() tenantId: string, @CurrentUser() user: AuthUser) {
    return this.staffService.getMySections(tenantId, user.id);
  }
}
