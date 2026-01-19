"""
Loan Tool API - Calculate loan amortization and savings
"""
from flask import Blueprint, request, jsonify

loan_tool_bp = Blueprint('loan_tool', __name__)


def generate_amortization(principal: float, monthly_rate: float, payment: float, extra: float) -> list:
    """Generate amortization schedule."""
    schedule = []
    balance = principal
    month = 0
    
    while balance > 0.01 and month < 600:
        month += 1
        interest_payment = balance * monthly_rate
        principal_payment = payment - interest_payment + extra
        
        if principal_payment > balance:
            principal_payment = balance
        
        balance -= principal_payment
        
        schedule.append({
            'month': month,
            'payment': round(interest_payment + principal_payment, 2),
            'principal': round(principal_payment, 2),
            'interest': round(interest_payment, 2),
            'balance': round(max(0, balance), 2)
        })
    
    return schedule


def calculate_loan_metrics(principal: float, annual_rate: float, years: int, extra_payment: float) -> dict:
    """Calculate loan metrics and amortization schedules."""
    monthly_rate = annual_rate / 100 / 12
    num_payments = years * 12
    
    # Standard payment calculation
    if monthly_rate > 0:
        monthly_payment = principal * (monthly_rate * (1 + monthly_rate) ** num_payments) / ((1 + monthly_rate) ** num_payments - 1)
    else:
        monthly_payment = principal / num_payments
    
    # Generate both schedules for comparison
    standard_schedule = generate_amortization(principal, monthly_rate, monthly_payment, 0)
    accelerated_schedule = generate_amortization(principal, monthly_rate, monthly_payment, extra_payment)
    
    standard_interest = sum(p['interest'] for p in standard_schedule)
    accelerated_interest = sum(p['interest'] for p in accelerated_schedule)
    interest_savings = standard_interest - accelerated_interest
    months_saved = len(standard_schedule) - len(accelerated_schedule)
    
    # Yearly summary for chart
    yearly_summary = []
    for i in range(0, len(accelerated_schedule), 12):
        year_data = accelerated_schedule[i:i + 12]
        if year_data:
            yearly_summary.append({
                'year': i // 12 + 1,
                'principal': round(sum(p['principal'] for p in year_data), 2),
                'interest': round(sum(p['interest'] for p in year_data), 2),
                'endBalance': year_data[-1]['balance']
            })
    
    return {
        'principal': principal,
        'annualRate': annual_rate,
        'years': years,
        'extraPayment': extra_payment,
        'monthlyPayment': round(monthly_payment + extra_payment, 2),
        'basePayment': round(monthly_payment, 2),
        'standardInterest': round(standard_interest, 2),
        'acceleratedInterest': round(accelerated_interest, 2),
        'interestSavings': round(interest_savings, 2),
        'monthsSaved': months_saved,
        'standardMonths': len(standard_schedule),
        'acceleratedMonths': len(accelerated_schedule),
        'standardYears': round(len(standard_schedule) / 12, 1),
        'acceleratedYears': round(len(accelerated_schedule) / 12, 1),
        'amortizationSchedule': accelerated_schedule,
        'yearlySummary': yearly_summary
    }


@loan_tool_bp.route('/loan/calculate', methods=['POST'])
def calculate_loan():
    """Calculate loan amortization and metrics."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        result = calculate_loan_metrics(
            principal=float(data.get('principal', 0)),
            annual_rate=float(data.get('annual_rate', 6.5)),
            years=int(data.get('years', 30)),
            extra_payment=float(data.get('extra_payment', 0))
        )
        return jsonify(result)
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
