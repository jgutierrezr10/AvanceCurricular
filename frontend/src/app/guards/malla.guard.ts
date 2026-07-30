import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const mallaGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isMallaPendiente()) {
    return true;
  }

  router.navigate(['/malla'], { queryParams: { tutorial: 'true' } });
  return false;
};
