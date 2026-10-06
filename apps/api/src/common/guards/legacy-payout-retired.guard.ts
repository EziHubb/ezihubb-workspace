import { CanActivate, GoneException, Injectable } from '@nestjs/common';

/** Freeze legacy payout mutations without rewriting historical financial rows.
 * Class-level authentication/role guards still execute before this route guard.
 * Never redirect a legacy amount/recipient automatically into a captured payout.
 */
@Injectable()
export class LegacyPayoutRetiredGuard implements CanActivate {
  canActivate(): never {
    throw new GoneException({
      code: 'ERR_LEGACY_PAYOUT_RETIRED',
      message: 'Legacy payouts are read-only and require reconciliation. Use verified captured balances for new payout requests and settlement verification.',
    });
  }
}
