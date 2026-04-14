"""
Platform-specific financial calculations.

Centralizes calculation logic for different BNPL/credit card platform types.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class EMIBreakdown:
    emi_amount: float
    total_interest: float
    total_payable: float
    financed_amount: float


@dataclass
class CCInterestProjection:
    interest_this_month: float
    minimum_due: float
    months_to_payoff: Optional[int]
    total_interest_if_minimum: Optional[float]


class BnplCalculator:
    """EMI-based calculations for BNPL apps, store EMIs, and finance companies."""

    @staticmethod
    def calculate_emi(
        principal: float,
        annual_rate: float,
        tenure_months: int,
        rate_type: str = "per_annum",
        processing_fee: float = 0.0,
    ) -> EMIBreakdown:
        """Calculate EMI and total payable.

        Args:
            principal: Financed amount (total - down payment)
            annual_rate: Interest rate (percentage)
            tenure_months: Number of EMIs
            rate_type: "per_annum" (reducing balance) or "flat"
            processing_fee: One-time processing fee
        """
        if principal <= 0 or tenure_months <= 0:
            return EMIBreakdown(
                emi_amount=0, total_interest=0,
                total_payable=processing_fee, financed_amount=0,
            )

        if rate_type == "flat" or annual_rate == 0:
            # Flat rate: simple calculation
            total_interest = principal * annual_rate / 100
            total_payable = principal + total_interest + processing_fee
            emi_amount = (principal + total_interest) / tenure_months
        else:
            # Per annum (reducing balance amortization)
            monthly_rate = annual_rate / 100 / 12
            if monthly_rate > 0:
                emi_amount = principal * monthly_rate * ((1 + monthly_rate) ** tenure_months) / (
                    ((1 + monthly_rate) ** tenure_months) - 1
                )
            else:
                emi_amount = principal / tenure_months
            total_interest = (emi_amount * tenure_months) - principal
            total_payable = principal + total_interest + processing_fee

        return EMIBreakdown(
            emi_amount=round(emi_amount, 2),
            total_interest=round(total_interest, 2),
            total_payable=round(total_payable, 2),
            financed_amount=round(principal, 2),
        )


class CreditCardCalculator:
    """Revolving credit calculations for credit cards.

    HDFC Credit Card specifics:
    - Interest rate: ~3.49% per month (~41.88% p.a.) on revolving balance
    - Minimum due: max(5% of total outstanding, Rs.200) + overdue amount
    - Interest-free period: ~20-50 days if full payment made by due date
    - Late payment fee: Rs.100-1300 based on outstanding amount
    """

    DEFAULT_MONTHLY_RATE = 3.49   # HDFC standard monthly rate (%)
    MIN_DUE_PERCENTAGE = 5.0      # 5% of total outstanding
    MIN_DUE_FLOOR = 200.0         # Minimum Rs.200

    def __init__(self, monthly_rate: float = DEFAULT_MONTHLY_RATE):
        self.monthly_rate = monthly_rate

    def calculate_interest(self, outstanding_balance: float) -> float:
        """Calculate interest on unpaid/revolving balance for one month."""
        if outstanding_balance <= 0:
            return 0.0
        return round(outstanding_balance * self.monthly_rate / 100, 2)

    def calculate_minimum_due(
        self,
        total_amount_due: float,
        overdue_amount: float = 0.0,
    ) -> float:
        """Calculate minimum amount due for a statement.

        HDFC formula: max(5% of total due, Rs.200) + any overdue from previous statements.
        """
        if total_amount_due <= 0:
            return 0.0
        base_minimum = max(
            total_amount_due * self.MIN_DUE_PERCENTAGE / 100,
            self.MIN_DUE_FLOOR,
        )
        # Cannot exceed total due
        return min(round(base_minimum + overdue_amount, 2), total_amount_due)

    def project_payoff(
        self,
        balance: float,
        monthly_payment: Optional[float] = None,
    ) -> CCInterestProjection:
        """Project how long to pay off balance and total interest paid.

        If monthly_payment is None, uses minimum due each month.
        """
        if balance <= 0:
            return CCInterestProjection(
                interest_this_month=0, minimum_due=0,
                months_to_payoff=0, total_interest_if_minimum=0,
            )

        interest_this_month = self.calculate_interest(balance)
        minimum_due = self.calculate_minimum_due(balance)

        payment = monthly_payment or minimum_due
        if payment <= interest_this_month:
            # Payment doesn't even cover interest — will never pay off
            return CCInterestProjection(
                interest_this_month=interest_this_month,
                minimum_due=minimum_due,
                months_to_payoff=None,
                total_interest_if_minimum=None,
            )

        # Simulate month-by-month payoff
        remaining = balance
        total_interest = 0.0
        months = 0
        max_months = 600  # 50 year cap

        while remaining > 0 and months < max_months:
            interest = remaining * self.monthly_rate / 100
            total_interest += interest
            remaining = remaining + interest - payment
            months += 1
            if remaining < 1:  # Close enough to zero
                remaining = 0

        return CCInterestProjection(
            interest_this_month=round(interest_this_month, 2),
            minimum_due=round(minimum_due, 2),
            months_to_payoff=months if months < max_months else None,
            total_interest_if_minimum=round(total_interest, 2) if months < max_months else None,
        )

    @staticmethod
    def calculate_late_fee(outstanding: float) -> float:
        """Calculate HDFC late payment fee based on outstanding amount."""
        if outstanding <= 0:
            return 0
        if outstanding <= 500:
            return 100
        if outstanding <= 5000:
            return 500
        if outstanding <= 10000:
            return 600
        if outstanding <= 25000:
            return 800
        if outstanding <= 50000:
            return 1100
        return 1300
