/**
 * Shared spending cap across every run in one `bench run`. Each agent step adds its reported
 * cost; once the total reaches the limit, running episodes stop after their current step and
 * no new maze starts. Episodes cut short this way are saved as unscored errors, so `--resume`
 * can finish them later.
 */
export class SpendGuard {
  spent = 0;

  constructor(readonly limitUsd: number) {}

  add(usd: number): void {
    this.spent += usd;
  }

  get tripped(): boolean {
    return this.spent >= this.limitUsd;
  }
}
