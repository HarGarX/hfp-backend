import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { Household } from '../households/entities/household.entity';
import { JwtPayload } from './strategies/jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    household_id: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Household)
    private householdsRepository: Repository<Household>,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersRepository.findOne({ 
      where: { email },
      relations: ['household'],
      select: ['id', 'email', 'first_name', 'last_name', 'role', 'household_id', 'password_hash', 'is_active', 'keycloak_id']
    });
    
    // Check if user exists and has a password hash (local authentication)
    if (user && user.password_hash && await this.comparePasswords(password, user.password_hash)) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      household_id: user.household_id,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        household_id: user.household_id,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: registerDto.email }
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create or find household
    let household: Household;
    if (registerDto.household_name) {
      // Create new household
      household = this.householdsRepository.create({
        name: registerDto.household_name,
      });
      household = await this.householdsRepository.save(household);
    } else {
      // Find or create default household
      let existingHousehold = await this.householdsRepository.findOne({
        where: { name: 'Default Household' }
      });

      if (!existingHousehold) {
        household = this.householdsRepository.create({
          name: 'Default Household',
        });
        household = await this.householdsRepository.save(household);
      } else {
        household = existingHousehold;
      }
    }

    // Hash password
    const hashedPassword = await this.hashPassword(registerDto.password);

    // Determine user role: if creating a new household, make them the admin
    const userRole = registerDto.household_name ? UserRole.HOUSEHOLD_ADMIN : UserRole.MEMBER;

    // Create user
    const user = this.usersRepository.create({
      email: registerDto.email,
      password_hash: hashedPassword,
      first_name: registerDto.first_name,
      last_name: registerDto.last_name,
      role: userRole,
      household_id: household.id,
      household: household,
    });

    const savedUser = await this.usersRepository.save(user);

    // Generate JWT token
    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
      household_id: savedUser.household_id,
      role: savedUser.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: savedUser.id,
        email: savedUser.email,
        first_name: savedUser.first_name,
        last_name: savedUser.last_name,
        role: savedUser.role,
        household_id: savedUser.household_id,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private async comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}