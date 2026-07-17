import { Module } from '@nestjs/common';

import { StudentLeavesController } from './student-leaves.controller';
import { StudentLeavesService } from './student-leaves.service';

@Module({
  controllers: [StudentLeavesController],
  providers: [StudentLeavesService],
})
export class StudentLeavesModule {}
