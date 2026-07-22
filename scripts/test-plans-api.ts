import { db } from '../src/lib/db'

async function main() {
  try {
    console.log('Test 1: count plans')
    const c = await db.subscriptionPlan.count()
    console.log('count =', c)
    console.log('Test 2: findMany active plans')
    const plans = await db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
    console.log('plans =', plans.map(p => p.code))
    console.log('Test 3: school count')
    const sc = await db.school.count()
    console.log('schools =', sc)
    console.log('Test 4: subscription count')
    const sub = await db.schoolSubscription.count()
    console.log('subscriptions =', sub)
    console.log('Test 5: invoice aggregate')
    const agg = await db.invoice.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } })
    console.log('revenue =', agg._sum.amount)
    console.log('Test 6: groupBy')
    const dist = await db.schoolSubscription.groupBy({
      by: ['planId'],
      where: { status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
      _count: { planId: true },
    })
    console.log('dist =', dist)
  } catch (e) {
    console.error('ERROR:', e)
  }
}
main().finally(() => process.exit(0))
