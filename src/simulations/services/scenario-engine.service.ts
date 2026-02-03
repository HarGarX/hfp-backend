import { Injectable, Logger } from '@nestjs/common';
import { GoalsService } from '../../goals/services/goals.service';
import { LoansService } from '../../loans/services/loans.service';
import {
  GoalSimulationDto,
  DebtPayoffSimulationDto,
  BudgetSimulationDto,
  RetirementSimulationDto,
} from '../dto';

export interface SimulationResult {
  success: boolean;
  data: Record<string, any>;
  projections?: Array<Record<string, any>>;
  summary?: Record<string, any>;
}

@Injectable()
export class ScenarioEngineService {
  private readonly logger = new Logger(ScenarioEngineService.name);

  constructor(
    private readonly goalsService: GoalsService,
    private readonly loansService: LoansService,
  ) {}

  async executeGoalSimulation(
    householdId: string,
    params: GoalSimulationDto,
  ): Promise<SimulationResult> {
    this.logger.log(`Executing goal simulation for household ${householdId}`);

    const {
      target_amount,
      monthly_contribution,
      current_amount = 0,
      expected_return_rate = 5, // 5% annual return
    } = params;

    const monthlyRate = expected_return_rate / 100 / 12;
    const projections: Array<{ month: number; year: number; balance: number; totalContributions: number; totalInterest: number }> = [];
    let balance = current_amount;
    let month = 0;
    let totalContributions = 0;
    let totalInterest = 0;

    // Project until goal is reached or 600 months (50 years)
    while (balance < target_amount && month < 600) {
      month++;
      balance += monthly_contribution;
      totalContributions += monthly_contribution;

      const interest = balance * monthlyRate;
      balance += interest;
      totalInterest += interest;

      if (month % 12 === 0 || balance >= target_amount) {
        projections.push({
          month,
          year: Math.floor(month / 12),
          balance: Math.round(balance * 100) / 100,
          totalContributions: Math.round(totalContributions * 100) / 100,
          totalInterest: Math.round(totalInterest * 100) / 100,
        });
      }
    }

    const yearsToGoal = month / 12;
    const goalReached = balance >= target_amount;

    return {
      success: true,
      data: {
        target_amount,
        starting_amount: current_amount,
        monthly_contribution,
        expected_return_rate,
        months_to_goal: month,
        years_to_goal: Math.round(yearsToGoal * 10) / 10,
        goal_reached: goalReached,
        final_balance: Math.round(balance * 100) / 100,
        total_contributions: Math.round(totalContributions * 100) / 100,
        total_interest: Math.round(totalInterest * 100) / 100,
      },
      projections,
      summary: {
        recommendation: goalReached
          ? `You will reach your goal of $${target_amount.toLocaleString()} in ${Math.ceil(yearsToGoal)} years.`
          : `With current contributions, you may not reach your goal. Consider increasing monthly contributions.`,
      },
    };
  }

  async executeDebtPayoffSimulation(
    householdId: string,
    params: DebtPayoffSimulationDto,
  ): Promise<SimulationResult> {
    this.logger.log(`Executing debt payoff simulation for household ${householdId}`);

    const { loan_ids, extra_payment_amount = 0, payoff_strategy = 'avalanche' } = params;

    // Fetch loans
    const loans: Array<any> = [];
    for (const loanId of loan_ids) {
      const loan = await this.loansService.findOne(loanId, householdId);
      loans.push(loan);
    }

    if (loans.length === 0) {
      return {
        success: false,
        data: { error: 'No loans found' },
      };
    }

    // Sort loans based on strategy
    const sortedLoans =
      payoff_strategy === 'snowball'
        ? loans.sort((a, b) => Number(a.principal_amount) - Number(b.principal_amount))
        : loans.sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate));

    let totalPaid = 0;
    let totalInterestPaid = 0;
    let month = 0;
    const loanBalances = sortedLoans.map(l => ({
      id: l.id,
      name: l.loan_name,
      balance: Number(l.principal_amount),
      rate: Number(l.interest_rate) / 100 / 12,
      minPayment: Number(l.monthly_payment || 0),
    }));

    const projections: Array<{ month: number; year: number; totalBalance: number; totalPaid: number; totalInterestPaid: number }> = [];

    while (loanBalances.some(l => l.balance > 0) && month < 600) {
      month++;
      let extraPayment = extra_payment_amount;

      for (const loan of loanBalances) {
        if (loan.balance <= 0) continue;

        // Calculate interest
        const interest = loan.balance * loan.rate;
        totalInterestPaid += interest;

        // Apply minimum payment
        const payment = Math.min(loan.minPayment, loan.balance + interest);
        loan.balance = loan.balance + interest - payment;
        totalPaid += payment;

        // Apply extra payment to first unpaid loan (snowball/avalanche)
        if (extraPayment > 0 && loan === loanBalances.find(l => l.balance > 0)) {
          const extraApplied = Math.min(extraPayment, loan.balance);
          loan.balance -= extraApplied;
          totalPaid += extraApplied;
          extraPayment -= extraApplied;
        }
      }

      if (month % 12 === 0) {
        projections.push({
          month,
          year: Math.floor(month / 12),
          totalBalance: Math.round(loanBalances.reduce((sum, l) => sum + Math.max(0, l.balance), 0) * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
        });
      }
    }

    const allPaidOff = loanBalances.every(l => l.balance <= 0);

    return {
      success: true,
      data: {
        total_debt: loans.reduce((sum, l) => sum + Number(l.principal_amount), 0),
        strategy: payoff_strategy,
        extra_payment_amount,
        months_to_payoff: month,
        years_to_payoff: Math.round((month / 12) * 10) / 10,
        all_paid_off: allPaidOff,
        total_paid: Math.round(totalPaid * 100) / 100,
        total_interest_paid: Math.round(totalInterestPaid * 100) / 100,
      },
      projections,
      summary: {
        recommendation: allPaidOff
          ? `All debts will be paid off in ${Math.ceil(month / 12)} years. Total interest: $${Math.round(totalInterestPaid).toLocaleString()}`
          : 'Consider increasing extra payments to pay off debts faster.',
      },
    };
  }

  async executeBudgetSimulation(
    householdId: string,
    params: BudgetSimulationDto,
  ): Promise<SimulationResult> {
    this.logger.log(`Executing budget simulation for household ${householdId}`);

    const { category_adjustments, income_change = 0, timeframe_months = 12 } = params;

    // Calculate monthly impact
    const monthlyImpact = Object.values(category_adjustments).reduce((sum, amt) => sum + amt, 0);
    const netMonthlyChange = income_change + monthlyImpact;

    const projections: Array<{ month: number; monthly_savings: number; cumulative_savings: number }> = [];
    let cumulativeSavings = 0;

    for (let month = 1; month <= timeframe_months; month++) {
      cumulativeSavings += netMonthlyChange;

      if (month % 3 === 0 || month === timeframe_months) {
        projections.push({
          month,
          monthly_savings: Math.round(netMonthlyChange * 100) / 100,
          cumulative_savings: Math.round(cumulativeSavings * 100) / 100,
        });
      }
    }

    return {
      success: true,
      data: {
        monthly_impact: Math.round(netMonthlyChange * 100) / 100,
        annual_impact: Math.round(netMonthlyChange * 12 * 100) / 100,
        timeframe_months,
        total_savings: Math.round(cumulativeSavings * 100) / 100,
      },
      projections,
      summary: {
        recommendation:
          netMonthlyChange > 0
            ? `These budget changes will save you $${Math.round(cumulativeSavings).toLocaleString()} over ${timeframe_months} months.`
            : `These changes will increase spending by $${Math.round(Math.abs(cumulativeSavings)).toLocaleString()} over ${timeframe_months} months.`,
      },
    };
  }

  async executeRetirementSimulation(
    householdId: string,
    params: RetirementSimulationDto,
  ): Promise<SimulationResult> {
    this.logger.log(`Executing retirement simulation for household ${householdId}`);

    const {
      current_age,
      retirement_age,
      current_savings,
      monthly_contribution,
      expected_return_rate = 7,
      expected_inflation_rate = 3,
      desired_retirement_income = 0,
    } = params;

    const yearsToRetirement = retirement_age - current_age;
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyRate = expected_return_rate / 100 / 12;

    let balance = current_savings;
    const projections: Array<{ age: number; balance: number; phase: string }> = [];
    let totalContributions = 0;

    // Accumulation phase
    for (let month = 1; month <= monthsToRetirement; month++) {
      balance += monthly_contribution;
      totalContributions += monthly_contribution;
      balance += balance * monthlyRate;

      if (month % 12 === 0) {
        projections.push({
          age: current_age + month / 12,
          balance: Math.round(balance * 100) / 100,
          phase: 'accumulation',
        });
      }
    }

    const retirementBalance = balance;

    // Calculate sustainable withdrawal (4% rule)
    const annualWithdrawal = retirementBalance * 0.04;
    const monthlyWithdrawal = annualWithdrawal / 12;

    return {
      success: true,
      data: {
        current_age,
        retirement_age,
        years_to_retirement: yearsToRetirement,
        current_savings,
        monthly_contribution,
        expected_return_rate,
        retirement_balance: Math.round(retirementBalance * 100) / 100,
        total_contributions: Math.round(totalContributions * 100) / 100,
        total_growth: Math.round((retirementBalance - current_savings - totalContributions) * 100) / 100,
        sustainable_monthly_income: Math.round(monthlyWithdrawal * 100) / 100,
        sustainable_annual_income: Math.round(annualWithdrawal * 100) / 100,
      },
      projections,
      summary: {
        recommendation:
          desired_retirement_income && monthlyWithdrawal < desired_retirement_income
            ? `To reach your desired retirement income of $${desired_retirement_income.toLocaleString()}/month, consider increasing your monthly contributions.`
            : `You're on track! At retirement, you'll have approximately $${Math.round(retirementBalance).toLocaleString()} which can provide $${Math.round(monthlyWithdrawal).toLocaleString()}/month.`,
      },
    };
  }
}
