import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth('JWT')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @RequirePermissions('students:read')
  @ApiOperation({ summary: 'List students, optionally by section' })
  list(@TenantId() tenantId: string, @Query('sectionId') sectionId?: string) {
    return this.studentsService.listStudents(tenantId, sectionId);
  }

  @Post()
  @RequirePermissions('students:create')
  @ApiOperation({ summary: 'Create student login and student profile' })
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStudentDto,
  ) {
    return this.studentsService.createStudent(tenantId, user.id, dto);
  }

  @Get('me')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Get logged-in student profile' })
  me(@TenantId() tenantId: string, @CurrentUser() user: AuthUser) {
    return this.studentsService.getMyProfile(tenantId, user.id);
  }
}
