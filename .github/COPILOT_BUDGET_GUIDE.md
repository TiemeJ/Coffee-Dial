# GitHub Copilot Budget Configuration Guide

## Problem
You're seeing this notification in GitHub Copilot Workspace:
> "You have exceeded your premium request allowance. We have automatically switched you to GPT-4.1 which is included with your plan. Enable additional paid premium requests to continue using premium models."

## Solution
To eliminate this notification and continue using premium models, you need to set up a paid budget for premium requests.

### Budget Recommendations

| Usage Level | Recommended Monthly Budget | Description |
|------------|---------------------------|-------------|
| Light | $5-10 | Occasional use, few premium model requests |
| Moderate | $20-50 | Regular project work, balanced usage |
| Heavy | $100+ | Intensive development, frequent premium requests |

### How to Enable the Budget

1. **Go to GitHub Settings**
   - Navigate to your GitHub account settings
   - Click on "Copilot" in the left sidebar

2. **Enable Premium Requests**
   - Find the "Premium Requests" section
   - Toggle "Enable additional paid premium requests"

3. **Set Your Budget**
   - Enter your desired monthly budget (minimum $1.00)
   - We recommend starting with **$20/month** for typical project work
   - You can adjust this anytime based on your actual usage

4. **Configure Alerts** (Optional)
   - Set an alert threshold (e.g., 80%) to get notified before hitting your limit
   - Choose fallback behavior when budget is exhausted

### Understanding the Costs

- Premium models (GPT-4, Claude Opus, etc.) are charged per request
- The free tier includes a limited number of premium requests per month
- Once exceeded, you either:
  - Switch to GPT-4.1 (free tier model) - less capable
  - Enable paid budget to continue with premium models

### Configuration File

The `.github/copilot-budget.yml` file in this repository provides a template configuration with:
- Default budget: $20/month
- Alert at 80% usage
- Fallback to free tier when exhausted

**Note:** The actual budget is set in your GitHub account settings, not just this config file. This file serves as documentation and reference for your project team.

### Quick Start

To get rid of the notification immediately:

1. Set budget to **$20/month** in GitHub Copilot settings
2. This allows approximately 200-400 premium requests per month (varies by model)
3. Monitor your usage and adjust accordingly

### FAQ

**Q: What's the minimum budget I can set?**  
A: The minimum is $1.00/month, but this may only cover a few premium requests.

**Q: What happens if I don't set a budget?**  
A: Copilot will automatically switch you to GPT-4.1 (the free tier model) once you exceed the free premium allowance.

**Q: Can I change my budget mid-month?**  
A: Yes, you can adjust your budget at any time in your GitHub settings.

**Q: How do I track my usage?**  
A: Check your GitHub Copilot dashboard for usage metrics and billing information.

---

**Bottom Line:** To eliminate the notification, go to your GitHub Copilot settings and enable a paid budget of at least **$20/month** for typical development work.
