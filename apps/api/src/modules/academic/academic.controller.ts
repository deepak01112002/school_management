import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AcademicService } from './academic.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { AssignSubjectDto, UpdateClassSubjectDto } from './dto/assign-subject.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('academic-years')
@ApiBearerAuth('JWT')
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academicService: AcademicService) {}

  @Get()
  @RequirePermissions('academic:read')
  @ApiOperation({ summary: 'List academic years' })
  list(@TenantId() tenantId: string) {
    return this.academicService.listAcademicYears(tenantId);
  }

  @Post()
  @RequirePermissions('academic:create')
  @ApiOperation({ summary: 'Create academic year' })
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAcademicYearDto,
  ) {
    return this.academicService.createAcademicYear(tenantId, user.id, dto);
  }

  @Patch(':id/activate')
  @RequirePermissions('academic:update')
  @ApiOperation({ summary: 'Mark academic year as active' })
  activate(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.academicService.activateAcademicYear(tenantId, user.id, id);
  }

  @Patch(':id/close')
  @RequirePermissions('academic:update')
  @ApiOperation({ summary: 'Close academic year' })
  close(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.academicService.closeAcademicYear(tenantId, user.id, id);
  }
}

@ApiTags('classes')
@ApiBearerAuth('JWT')
@Controller('classes')
export class ClassesController {
  constructor(private readonly academicService: AcademicService) {}

  @Get()
  @RequirePermissions('academic:read')
  @ApiOperation({ summary: 'List classes with sections' })
  list(@TenantId() tenantId: string, @Query('academicYearId') academicYearId?: string) {
    return this.academicService.listClasses(tenantId, academicYearId);
  }

  @Post()
  @RequirePermissions('academic:create')
  @ApiOperation({ summary: 'Create class' })
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClassDto,
  ) {
    return this.academicService.createClass(tenantId, user.id, dto);
  }

  @Delete(':id')
  @RequirePermissions('academic:delete')
  @ApiOperation({ summary: 'Delete class' })
  delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.academicService.deleteClass(tenantId, user.id, id);
  }
}

@ApiTags('sections')
@ApiBearerAuth('JWT')
@Controller('sections')
export class SectionsController {
  constructor(private readonly academicService: AcademicService) {}

  @Post()
  @RequirePermissions('academic:create')
  @ApiOperation({ summary: 'Create section' })
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSectionDto,
  ) {
    return this.academicService.createSection(tenantId, user.id, dto);
  }

  @Delete(':id')
  @RequirePermissions('academic:delete')
  @ApiOperation({ summary: 'Delete section' })
  delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.academicService.deleteSection(tenantId, user.id, id);
  }
}

@ApiTags('subjects')
@ApiBearerAuth('JWT')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly academicService: AcademicService) {}

  @Get()
  @RequirePermissions('academic:read')
  @ApiOperation({ summary: 'List all subjects for this tenant' })
  list(@TenantId() tenantId: string) {
    return this.academicService.listSubjects(tenantId);
  }

  @Post()
  @RequirePermissions('academic:create')
  @ApiOperation({ summary: 'Create a subject' })
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSubjectDto,
  ) {
    return this.academicService.createSubject(tenantId, user.id, dto);
  }

  @Delete(':id')
  @RequirePermissions('academic:delete')
  @ApiOperation({ summary: 'Delete a subject' })
  delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.academicService.deleteSubject(tenantId, user.id, id);
  }
}

@ApiTags('class-subjects')
@ApiBearerAuth('JWT')
@Controller('class-subjects')
export class ClassSubjectsController {
  constructor(private readonly academicService: AcademicService) {}

  @Get()
  @RequirePermissions('academic:read')
  @ApiOperation({ summary: 'List subjects assigned to a class' })
  list(@TenantId() tenantId: string, @Query('classId') classId: string) {
    return this.academicService.listClassSubjects(tenantId, classId);
  }

  @Post()
  @RequirePermissions('academic:create')
  @ApiOperation({ summary: 'Assign a subject to a class (optionally with a teacher)' })
  assign(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AssignSubjectDto,
  ) {
    return this.academicService.assignSubjectToClass(tenantId, user.id, dto);
  }

  @Patch(':id')
  @RequirePermissions('academic:update')
  @ApiOperation({ summary: 'Update teacher or elective flag for a class-subject' })
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateClassSubjectDto,
  ) {
    return this.academicService.updateClassSubject(tenantId, user.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('academic:delete')
  @ApiOperation({ summary: 'Remove a subject from a class' })
  remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.academicService.removeSubjectFromClass(tenantId, user.id, id);
  }
}
