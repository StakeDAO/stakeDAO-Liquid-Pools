import Fixture from '../../livepeer-protocol/test/unit/helpers/Fixture'

const ERC20Mintable = artifacts.require('ERC20Mintable')
const LivepeerAllocationStrategy = artifacts.require('LivepeerAllocationStrategy')
const RToken = artifacts.require('RToken')
const BondingManager = artifacts.require('BondingManager')
const SortedDoublyLL = artifacts.require('SortedDoublyLL')

const { toWad, wad4human } = require('@decentral.ee/web3-test-helpers')
import { functionSig, functionEncodedABI } from '../../livepeer-protocol/utils/helpers'

const toBN = (numberString) => web3.utils.toBN(numberString)

contract('RToken using LivepeerAllocationStrategy', ([admin, staker1, staker2, staker3, stakeCapitalTranscoder]) => {

    const NUM_TRANSCODERS = 5
    const NUM_ACTIVE_TRANSCODERS = 2
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20
    const LIVEPEER_PERC_MULTIPLIER = 10000

    let fixture
    let livepeerToken, livepeerAllocationStrategy, rToken, bondingManager

    before(async () => {
        fixture = new Fixture(web3)
        await fixture.deploy()

        const sortedDoublyLL = await SortedDoublyLL.new()
        await BondingManager.link('SortedDoublyLL', sortedDoublyLL.address)

        bondingManager = await fixture.deployAndRegister(BondingManager, 'BondingManager', fixture.controller.address)

        await bondingManager.setUnbondingPeriod(UNBONDING_PERIOD)
        await bondingManager.setNumTranscoders(NUM_TRANSCODERS)
        await bondingManager.setNumActiveTranscoders(NUM_ACTIVE_TRANSCODERS)
        await bondingManager.setMaxEarningsClaimsRounds(MAX_EARNINGS_CLAIMS_ROUNDS)

        livepeerToken = await fixture.deployAndRegister(ERC20Mintable, 'LivepeerToken')
    })

    beforeEach(async () => {
        await fixture.setUp()

        await livepeerToken.mint(staker1, toWad(1000))
        await livepeerToken.mint(staker2, toWad(1000))
        await livepeerToken.mint(stakeCapitalTranscoder, toWad(1000))

        livepeerAllocationStrategy = await LivepeerAllocationStrategy
            .new(livepeerToken.address, bondingManager.address, fixture.roundsManager.address, stakeCapitalTranscoder)

        rToken = await RToken.new()
        await rToken.initialize(livepeerAllocationStrategy.address, 'RToken Test', 'RTOKEN', 18)

        await livepeerAllocationStrategy.transferOwnership(rToken.address)
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    async function printAccount(account) {
        let accountName
        if (account === admin) accountName = 'admin'
        else if (account === staker1) accountName = 'staker1'
        else if (account === staker2) accountName = 'staker2'
        else if (account === staker3) accountName = 'staker3'

        const tokenBalance = await rToken.balanceOf.call(account)
        console.log(`\n${accountName} tokenBalance ${tokenBalance}`)

        const receivedLoan = await rToken.receivedLoanOf.call(account)
        console.log(`${accountName} receivedLoan ${receivedLoan}`)

        const receivedSavings = await rToken.receivedSavingsOf.call(account)
        console.log(`${accountName} receivedSavings ${receivedSavings}`)

        const interestPayable = await rToken.interestPayableOf.call(account)
        console.log(`${accountName} interestPayable ${interestPayable}`)

        const accountStats = await rToken.getAccountStats.call(account)

        const cumulativeInterest = accountStats.cumulativeInterest
        console.log(`${accountName} cumulativeInterest ${cumulativeInterest}`)

        const rInterest = accountStats.rInterest
        console.log(`${accountName} rInterest ${rInterest}`)

        const sInternalAmount = accountStats.sInternalAmount
        console.log(`${accountName} sInternalAmount ${sInternalAmount}`)

        const lDebt = accountStats.lDebt
        console.log(`${accountName} lDebt ${lDebt}`)

        const rAmount = accountStats.rAmount
        console.log(`${accountName} rAmount ${rAmount}`)
    }

    async function printExchangeRate() {
        console.log(`\nExchange rate: ${await livepeerAllocationStrategy.exchangeRateStored()}`)
    }

    async function printDelegatorInfo() {
        // console.log(await bondingManager.getDelegator(livepeerAllocationStrategy.address))
        console.log(`\nBonded Amount: ${(await bondingManager.getDelegator(livepeerAllocationStrategy.address)).bondedAmount.toString()}`)
        console.log(`Transcoder Bonded Amount: ${(await bondingManager.transcoderTotalStake(stakeCapitalTranscoder)).toString()}`)
    }

    async function printTranscoderBondedAmount() {
        console.log(`\nTranscoder Bonded Amount: ${(await bondingManager.transcoderTotalStake(stakeCapitalTranscoder)).toString()}`)
    }

    async function transcoderReward(rewardValue, round) {
        await fixture.roundsManager.setMockUint256(functionSig('currentRound()'), round)
        await fixture.roundsManager.execute(bondingManager.address, functionSig('setActiveTranscoders()'))
        await fixture.jobsManager.execute(
            bondingManager.address,
            functionEncodedABI(
                'updateTranscoderWithFees(address,uint256,uint256)',
                ['address', 'uint256', 'uint256'],
                [stakeCapitalTranscoder, 1000, round]
            )
        )
        await fixture.minter.setMockUint256(functionSig('createReward(uint256,uint256)'), rewardValue)
        // await livepeerToken.mint(fixture.minter.address, rewardValue)

        // Reward with transcoder reward at 50% will distribute half the rewardValue to stakers relative to their stake
        await bondingManager.reward({ from: stakeCapitalTranscoder })
    }

    describe('mint(uint256 mintAmount) - RToken Staker1', () => {

        const currentRound = 100
        const staker1BondedAmount = 100

        beforeEach(async () => {
            await fixture.roundsManager.setMockBool(functionSig('currentRoundInitialized()'), true)
            await fixture.roundsManager.setMockBool(functionSig('currentRoundLocked()'), false)
            await fixture.roundsManager.setMockUint256(functionSig('currentRound()'), currentRound)

            await livepeerToken.approve(bondingManager.address, toWad(100), { from: stakeCapitalTranscoder })
            await bondingManager.bond(toWad(100), stakeCapitalTranscoder, { from: stakeCapitalTranscoder })
            await bondingManager.transcoder(50 * LIVEPEER_PERC_MULTIPLIER, 10 * LIVEPEER_PERC_MULTIPLIER, 100, { from: stakeCapitalTranscoder })

            await livepeerToken.approve(rToken.address, toWad(staker1BondedAmount), { from: staker1 })
            await rToken.mint(toWad(staker1BondedAmount), { from: staker1 })
        })

        it('updates exchange rate, bonds and updates user rtoken balance', async () => {
            const delagatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)

            assert.equal((await rToken.balanceOf(staker1)).toString(), toWad(staker1BondedAmount).toString())
            assert.equal((await livepeerAllocationStrategy.exchangeRateStored()).toString(), toWad(1).toString())
            assert.equal(delagatorInfo.bondedAmount.toString(), toWad(100).toString())
        })

        describe('reward() - BondingManager', () => {

            beforeEach(async () => {
                await transcoderReward(1000, currentRound + 1)
            })

            it('accrues interest for staker1', async () => {
                await rToken.payInterest(staker1)
                // Check updating the exchange rate a second time before reward is called again doesn't upset the result
                await rToken.payInterest(staker1)

                const delegatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                const exchangeRate = await livepeerAllocationStrategy.exchangeRateStored()
                const stakerBalance = await rToken.balanceOf(staker1)

                assert.equal(delegatorInfo.bondedAmount.toString(), '100000000000000000250')
                // Note we lose precision here, the correct exchange rate would be 100000000000000000250
                // But we only have 18 decimals of precision. We can increase precision to mitigate this issue.
                assert.equal(exchangeRate.toString(), '1000000000000000002')
                // The correct balance would be 100000000000000000250
                assert.equal(stakerBalance.toString(), '100000000000000000200')
            })

            describe('transfer(address dst, uint256 amount)', () => {

                it('sends correct amount', async () => {
                    const transferAmount = toBN('50000000000000000100')
                    await rToken.transfer(staker3, transferAmount, { from: staker1 })

                    const accountStats = await rToken.getAccountStats.call(staker3)
                    assert.equal((await rToken.balanceOf(staker3)).toString(), transferAmount.toString())
                    assert.equal(accountStats.rAmount.toString(), transferAmount.toString())
                })
            })

            describe('mint(uint256 mintAmount) - RToken Staker2', () => {

                const staker2BondedAmount = 100

                beforeEach(async () => {
                    await livepeerToken.approve(rToken.address, toWad(staker2BondedAmount), { from: staker2 })
                    await rToken.mint(toWad(staker2BondedAmount), { from: staker2 })
                })

                it('updates exchange rate, bonds and updates user rtoken balance', async () => {
                    const delagatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                    assert.equal((await rToken.balanceOf(staker2)).toString(), toWad(staker2BondedAmount).toString())
                    assert.equal((await livepeerAllocationStrategy.exchangeRateStored()).toString(), '1000000000000000002')
                    assert.equal(delagatorInfo.bondedAmount.toString(), '200000000000000000250')
                })

                describe('reward() - BondingManager * 2', () => {

                    beforeEach(async () => {
                        await transcoderReward(1500, currentRound + 2)
                        await transcoderReward(1500, currentRound + 3)
                    })

                    it('accrues interest for staker1 and staker2', async () => {
                        await rToken.payInterest(staker1)
                        await rToken.payInterest(staker2)

                        const staker1Balance = await rToken.balanceOf(staker1)
                        const staker2Balance = await rToken.balanceOf(staker2)

                        // Note precision error, should be 100000000000000000700 (we loose 50 for each reward)
                        assert.equal(staker1Balance.toString(), '100000000000000000600')
                        // Note precision error, should be 100000000000000000500
                        assert.equal(staker2Balance.toString(), '100000000000000000399')
                    })

                    describe('redeem(uint256 redeemTokens) - RToken Staker2', async () => {

                        let redeemAmount, unbondingLockId

                        beforeEach(async () => {
                            await rToken.payInterest(staker2)
                            const staker2Balance = await rToken.balanceOf(staker2)
                            redeemAmount = staker2Balance.div(toBN('2'))

                            unbondingLockId = (await bondingManager.getDelegator(livepeerAllocationStrategy.address)).nextUnbondingLockId
                            await rToken.redeem(redeemAmount, { from: staker2 })
                        })

                        it('unbonds and returns LPT to user after unbonding period', async () => {
                            await fixture.roundsManager.setMockUint256(functionSig('currentRound()'), currentRound + 10)
                            // This mocks the behaviour of the Minter contract, giving the livepeerAllocationStrategy the unbonded LPT
                            // We need to either create a real instance of the Minter or test with full integration tests.
                            await livepeerToken.mint(livepeerAllocationStrategy.address, redeemAmount);

                            await livepeerAllocationStrategy.withdrawUnbondingLock(unbondingLockId, { from: staker2 })

                            const delegatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                            assert.equal((await rToken.balanceOf(staker2)).toString(), '50000000000000000200')
                            assert.equal((await livepeerToken.balanceOf(staker2)).toString(), '950000000000000000199')
                            assert.equal(delegatorInfo.bondedAmount.toString(), '150000000000000001049')
                        })

                        describe('mint(uint256 redeemTokens) - RToken Staker2', async () => {

                            it('accrues expected amount after minting more', async () => {
                                await livepeerToken.approve(rToken.address, toWad(staker2BondedAmount), { from: staker2 })
                                await rToken.mint(toWad(staker2BondedAmount), { from: staker2 })

                                // Lost 107 due to precision errors here (142 became 100 for staker1, 214 became 150 for staker2)
                                await transcoderReward(1000, currentRound + 4)
                                await rToken.payInterest(staker1)
                                await rToken.payInterest(staker2)

                                // Initial balance is 900000000000000000000
                                assert.equal((await livepeerToken.balanceOf(staker2)).toString(), '800000000000000000000')

                                // Due to rounding error, the total delegated ends in 1406, but the total redeemable is 700 + 350 = 1050
                                assert.equal((await rToken.balanceOf(staker1)).toString(), '100000000000000000700')
                                assert.equal((await rToken.balanceOf(staker2)).toString(), '150000000000000000350')
                                const delegatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                                assert.equal(delegatorInfo.bondedAmount.toString(), '250000000000000001406')
                            })
                        })
                    })
                })
            })
        })
    })

})
