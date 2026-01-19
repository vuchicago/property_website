"""
ROI Calculator API - Calculate real estate investment returns
"""
from flask import Blueprint, request, jsonify

roi_calculator_bp = Blueprint('roi_calculator', __name__)


def calculate_roi_metrics(
    purchase_price: float,
    down_payment_pct: float,
    closing_costs: float,
    rehab_costs: float,
    monthly_rent: float,
    vacancy_rate: float,
    monthly_expenses: float,
    mortgage_payment: float
) -> dict:
    """Calculate all ROI metrics for a real estate investment."""
    
    down_payment = purchase_price * (down_payment_pct / 100)
    total_cash_invested = down_payment + closing_costs + rehab_costs
    
    effective_rent = monthly_rent * (1 - vacancy_rate / 100)
    annual_rent = effective_rent * 12
    annual_expenses = monthly_expenses * 12
    annual_mortgage = mortgage_payment * 12
    
    noi = annual_rent - annual_expenses
    annual_cash_flow = noi - annual_mortgage
    monthly_cash_flow = annual_cash_flow / 12
    
    cap_rate = (noi / purchase_price * 100) if purchase_price > 0 else 0
    coc_return = (annual_cash_flow / total_cash_invested * 100) if total_cash_invested > 0 else 0
    break_even_rent = (monthly_expenses + mortgage_payment) / (1 - vacancy_rate / 100) if vacancy_rate < 100 else 0
    
    # Generate insights
    if coc_return >= 8:
        coc_insight = {'status': 'good', 'message': 'Excellent return above the 8% benchmark!'}
    elif coc_return >= 4:
        coc_insight = {'status': 'moderate', 'message': 'Moderate return. Consider ways to increase income.'}
    else:
        coc_insight = {'status': 'warning', 'message': 'Low return. Review expenses and rent pricing.'}
    
    if cap_rate >= 6:
        cap_insight = {'status': 'good', 'message': 'Strong CAP rate indicates solid investment.'}
    elif cap_rate >= 4:
        cap_insight = {'status': 'moderate', 'message': 'Average CAP rate for the market.'}
    else:
        cap_insight = {'status': 'warning', 'message': 'Low CAP rate - property may be overpriced.'}
    
    if monthly_cash_flow > 200:
        cashflow_insight = {'status': 'good', 'message': 'Strong positive cash flow!'}
    elif monthly_cash_flow > 0:
        cashflow_insight = {'status': 'moderate', 'message': 'Positive but thin margins.'}
    else:
        cashflow_insight = {'status': 'warning', 'message': 'Negative cash flow - property costs more than it earns.'}
    
    return {
        'purchasePrice': purchase_price,
        'downPayment': round(down_payment, 2),
        'closingCosts': closing_costs,
        'rehabCosts': rehab_costs,
        'totalCashInvested': round(total_cash_invested, 2),
        'monthlyRent': monthly_rent,
        'vacancyRate': vacancy_rate,
        'monthlyExpenses': monthly_expenses,
        'mortgagePayment': mortgage_payment,
        'noi': round(noi, 2),
        'annualCashFlow': round(annual_cash_flow, 2),
        'monthlyCashFlow': round(monthly_cash_flow, 2),
        'capRate': round(cap_rate, 2),
        'cocReturn': round(coc_return, 2),
        'breakEvenRent': round(break_even_rent, 2),
        'insights': {
            'coc': coc_insight,
            'cap': cap_insight,
            'cashflow': cashflow_insight
        }
    }


@roi_calculator_bp.route('/roi/calculate', methods=['POST'])
def calculate_roi():
    """Calculate ROI metrics for a real estate investment."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        result = calculate_roi_metrics(
            purchase_price=float(data.get('purchase_price', 0)),
            down_payment_pct=float(data.get('down_payment_pct', 20)),
            closing_costs=float(data.get('closing_costs', 0)),
            rehab_costs=float(data.get('rehab_costs', 0)),
            monthly_rent=float(data.get('monthly_rent', 0)),
            vacancy_rate=float(data.get('vacancy_rate', 5)),
            monthly_expenses=float(data.get('monthly_expenses', 0)),
            mortgage_payment=float(data.get('mortgage_payment', 0))
        )
        return jsonify(result)
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid input: {str(e)}'}), 400
