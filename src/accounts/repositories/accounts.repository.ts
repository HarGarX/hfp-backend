import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { Account } from '../entities/account.entity';

@Injectable()
export class AccountsRepository extends BaseRepository<Account> {
  constructor(private dataSource: DataSource) {
    super(Account, dataSource.createEntityManager());
  }
}
