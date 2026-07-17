import { Module } from '@nestjs/common';

import { AcademicService } from './academic.service';
import {
  AcademicYearsController,
  ClassesController,
  ClassSubjectsController,
  SectionsController,
  SubjectsController,
} from './academic.controller';

@Module({
  controllers: [
    AcademicYearsController,
    ClassesController,
    SectionsController,
    SubjectsController,
    ClassSubjectsController,
  ],
  providers: [AcademicService],
  exports: [AcademicService],
})
export class AcademicModule {}
