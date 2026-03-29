import { Injectable } from '@nestjs/common';
import { CreateMealDto } from '../dto/create-meal.dto';
import { MealsRepository } from '../repositories/meals.repository';

@Injectable()
export class CreateMealUseCase {
  constructor(private readonly mealsRepository: MealsRepository) {}

  execute(userId: string, dto: CreateMealDto) {
    return this.mealsRepository.create(userId, dto);
  }
}
