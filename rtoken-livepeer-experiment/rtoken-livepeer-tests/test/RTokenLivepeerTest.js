import Fixture from '../../livepeer-protocol/test/unit/helpers/Fixture'

const ERC20Mintable = artifacts.require('ERC20Mintable')
const LivepeerAllocationStrategy = artifacts.require('LivepeerAllocationStrategy')
const RToken = artifacts.require('RToken')
const BondingManager = artifacts.require('BondingManager')
const SortedDoublyLL = artifacts.require('SortedDoublyLL')

const { toWad, toDecimals } = require('@decentral.ee/web3-test-helpers')
import { functionSig, functionEncodedABI } from '../../livepeer-protocol/utils/helpers'

const toBN = (numberString) => web3.utils.toBN(numberString)
const toBNWithDecimals = (numberString, decimals) => web3.utils.toBN(toDecimals(numberString, decimals))

contract('RToken using LivepeerAllocationStrategy', ([admin, staker1, staker2, staker3, stakeCapitalTranscoder, stakeCapitalTranscoder2]) => {

    const NUM_TRANSCODERS = 5
    const NUM_ACTIVE_TRANSCODERS = 2
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20
    const LIVEPEER_PERC_MULTIPLIER = 10000
    const INITIAL_BALANCE = toWad(100000)

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

        await livepeerToken.mint(staker1, INITIAL_BALANCE)
        await livepeerToken.mint(staker2, INITIAL_BALANCE)
        await livepeerToken.mint(stakeCapitalTranscoder, INITIAL_BALANCE)
        await livepeerToken.mint(stakeCapitalTranscoder2, INITIAL_BALANCE)

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
        console.log(`Delegator Fees: ${(await bondingManager.getDelegator(livepeerAllocationStrategy.address)).fees.toString()}`)
    }

    async function printTranscoderBondedAmount() {
        console.log(`\nTranscoder Bonded Amount: ${(await bondingManager.transcoderTotalStake(stakeCapitalTranscoder)).toString()}`)
    }

    async function transcoderReward(transcoderAddress, rewardValue, round) {
        await fixture.roundsManager.setMockUint256(functionSig('currentRound()'), round)
        await fixture.roundsManager.execute(bondingManager.address, functionSig('setActiveTranscoders()'))
        await fixture.jobsManager.execute(
            bondingManager.address,
            functionEncodedABI(
                'updateTranscoderWithFees(address,uint256,uint256)',
                ['address', 'uint256', 'uint256'],
                [transcoderAddress, 1000, round]
            )
        )
        await fixture.minter.setMockUint256(functionSig('createReward(uint256,uint256)'), rewardValue)

        // Reward with transcoder reward at 50% will distribute half the rewardValue to stakers relative to their stake
        await bondingManager.reward({ from: transcoderAddress })
    }

    const commonAssertions = async () => {
        const delagatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
        assert.isTrue(delagatorInfo.bondedAmount.gte(await rToken.totalSupply()))
    }

    describe('mint(uint256 mintAmount) - RToken Staker1', () => {

        let currentRound = 100
        const staker1BondedAmount = toWad(100)
        const transcoderBondedAmount = toWad(100)
        const rewardPct = 50 * LIVEPEER_PERC_MULTIPLIER // transcoder keeps 50% of reward
        const feePct = 10 * LIVEPEER_PERC_MULTIPLIER // delegators get 10% of fees
        const pricePerSegment = 100

        beforeEach(async () => {
            await fixture.roundsManager.setMockBool(functionSig('currentRoundInitialized()'), true)
            await fixture.roundsManager.setMockBool(functionSig('currentRoundLocked()'), false)
            await fixture.roundsManager.setMockUint256(functionSig('currentRound()'), currentRound)

            await livepeerToken.approve(bondingManager.address, transcoderBondedAmount, { from: stakeCapitalTranscoder })
            await bondingManager.bond(transcoderBondedAmount, stakeCapitalTranscoder, { from: stakeCapitalTranscoder })
            await bondingManager.transcoder(rewardPct, feePct, pricePerSegment, { from: stakeCapitalTranscoder })

            await livepeerToken.approve(rToken.address, staker1BondedAmount, { from: staker1 })
            await rToken.mint(staker1BondedAmount, { from: staker1 })
        })

        it('updates exchange rate, bonds and updates user rtoken balance', async () => {
            const delagatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)

            assert.equal((await rToken.balanceOf(staker1)).toString(), staker1BondedAmount.toString(), 'staker balance wrong')
            assert.equal((await livepeerAllocationStrategy.exchangeRateStored()).toString(), toBNWithDecimals(1, 28).toString(), 'exchange rate wrong')
            assert.equal(delagatorInfo.bondedAmount.toString(), staker1BondedAmount.toString(), 'bonded amount wrong')
            await commonAssertions()
        })

        describe('reward() - BondingManager', () => {

            beforeEach(async () => {
                await transcoderReward(stakeCapitalTranscoder, 1000, ++currentRound)
            })

            it('accrues interest for staker1', async () => {
                await rToken.payInterest(staker1)
                // Check updating the exchange rate a second time before reward is called again doesn't upset the result
                await rToken.payInterest(staker1)

                const delegatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                const exchangeRate = await livepeerAllocationStrategy.exchangeRateStored()
                const stakerBalance = await rToken.balanceOf(staker1)

                // Should be delegated amount + 1000 / 2 (half for transcoder) = 500 / 2 (2 delegators delegated 100 each) = 250
                assert.equal(delegatorInfo.bondedAmount.toString(), '100000000000000000250', 'bonded amount wrong')
                assert.equal(exchangeRate.toString(), '10000000000000000025000000000', 'exchange rate wrong')
                assert.equal(stakerBalance.toString(), '100000000000000000250', 'staker balance wrong')
                await commonAssertions()
            })

            describe('transfer(address dst, uint256 amount) - RToken', () => {

                const transferAmount = toBN('50000000000000000100')

                beforeEach(async () => {
                    await rToken.transfer(staker3, transferAmount, { from: staker1 })
                })

                it('sends correct amount', async () => {
                    const accountStats = await rToken.getAccountStats.call(staker3)
                    assert.equal((await rToken.balanceOf(staker1)).toString(), '50000000000000000150')
                    assert.equal((await rToken.balanceOf(staker3)).toString(), transferAmount.toString())
                    assert.equal(accountStats.rAmount.toString(), transferAmount.toString())
                    await commonAssertions()
                })

                describe('reward() - BondingManager', () => {

                    it('rewards correct amount after transfer balances', async () => {
                        await transcoderReward(stakeCapitalTranscoder, 1000, ++currentRound)

                        await rToken.payInterest(staker1)
                        await rToken.payInterest(staker3)

                        const staker1Balance = await rToken.balanceOf(staker1)
                        const staker3Balance = await rToken.balanceOf(staker3)

                        // Note precision error, should be 50000000000000000275, presumably comes from BondingManager
                        // Should be balance + 1000 reward / 2 (half for transcoder) = 500 / 4 (3 delegators delegated 100, 50, 50) = 125
                        assert.equal(staker1Balance.toString(), '50000000000000000274')
                        // Note precision error, should be 50000000000000000224 when doing
                        assert.equal(staker3Balance.toString(), '50000000000000000224')
                        await commonAssertions()
                    })
                })
            })

            describe('mint(uint256 mintAmount) - RToken Staker2', () => {

                const staker2BondedAmount = toWad(100)

                beforeEach(async () => {
                    await livepeerToken.approve(rToken.address, staker2BondedAmount, { from: staker2 })
                    await rToken.mint(staker2BondedAmount, { from: staker2 })
                })

                it('updates exchange rate, bonds and updates user rtoken balance', async () => {
                    const delagatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                    assert.equal((await rToken.balanceOf(staker2)).toString(), staker2BondedAmount.toString())
                    assert.equal((await livepeerAllocationStrategy.exchangeRateStored()).toString(), '10000000000000000025000000000')
                    assert.equal(delagatorInfo.bondedAmount.toString(), '200000000000000000250')
                    await commonAssertions()
                })

                describe('reward() - BondingManager * 2', () => {

                    beforeEach(async () => {
                        await transcoderReward(stakeCapitalTranscoder, 1500, ++currentRound)
                        await transcoderReward(stakeCapitalTranscoder, 1500, ++currentRound)
                    })

                    it('accrues interest for staker1 and staker2', async () => {
                        await rToken.payInterest(staker1)
                        await rToken.payInterest(staker2)

                        const staker1Balance = await rToken.balanceOf(staker1)
                        const staker2Balance = await rToken.balanceOf(staker2)

                        // Note precision error, should be 100000000000000000750, presumably comes from BondingManager
                        assert.equal(staker1Balance.toString(), '100000000000000000748')
                        // Note precision error, should be 100000000000000000500 when doing
                        // 1500 reward / 2 (half for transcoder) = 750 / 3 (3 delegators delegated 100 each) = 250 * 2 rewards = 500
                        assert.equal(staker2Balance.toString(), '100000000000000000498')
                        await commonAssertions()
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
                            await livepeerToken.mint(livepeerAllocationStrategy.address, redeemAmount)

                            await livepeerAllocationStrategy.withdrawUnbondingLock(unbondingLockId, { from: staker2 })

                            const delegatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                            // Original balance was 100000000000000000498, we unbonded half of it
                            assert.equal((await rToken.balanceOf(staker2)).toString(), '50000000000000000249')
                            assert.equal((await livepeerToken.balanceOf(staker2)).toString(), '99950000000000000000249')
                            assert.equal(delegatorInfo.bondedAmount.toString(), '150000000000000000999')
                            await commonAssertions()
                        })

                        describe('mint(uint256 redeemTokens) - RToken Staker2', async () => {

                            it('accrues expected amount after minting more', async () => {
                                await livepeerToken.approve(rToken.address, staker2BondedAmount, { from: staker2 })
                                await rToken.mint(staker2BondedAmount, { from: staker2 })

                                await transcoderReward(stakeCapitalTranscoder, 1000, ++currentRound)
                                await rToken.payInterest(staker1)
                                await rToken.payInterest(staker2)

                                const delegatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                                // Initial balance is 99900000000000000000000
                                assert.equal((await livepeerToken.balanceOf(staker2)).toString(), '99800000000000000000000')
                                assert.equal((await rToken.balanceOf(staker1)).toString(), '100000000000000000891')
                                assert.equal((await rToken.balanceOf(staker2)).toString(), '150000000000000000464')
                                assert.equal(delegatorInfo.bondedAmount.toString(), '250000000000000001356')
                                await commonAssertions()
                            })
                        })
                    })
                })
            })

            describe('updateTranscoder(address stakeCapitalTranscoder) - LivepeerAllocationStrategy', () => {

                const transcoderBondedAmount2 = toWad(150)
                const rewardPct2 = 25 * LIVEPEER_PERC_MULTIPLIER // transcoder keeps 25% of reward

                it('accrues correct interest when transcoder changed between rewards', async () => {
                    await livepeerToken.approve(bondingManager.address, transcoderBondedAmount2, { from: stakeCapitalTranscoder2 })
                    await bondingManager.bond(transcoderBondedAmount2, stakeCapitalTranscoder2, { from: stakeCapitalTranscoder2 })
                    await bondingManager.transcoder(rewardPct2, feePct, pricePerSegment, { from: stakeCapitalTranscoder2 })

                    await livepeerAllocationStrategy.updateTranscoder(stakeCapitalTranscoder2)
                    await transcoderReward(stakeCapitalTranscoder2, 1000, ++currentRound)
                    await rToken.payInterest(staker1)

                    const delegatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)
                    const exchangeRate = await livepeerAllocationStrategy.exchangeRateStored()
                    const stakerBalance = await rToken.balanceOf(staker1)

                    // Should be 1000 * 0.75 (25% for transcoder) = 750 * 0.4 (2 delegators, 1 @ 150, 1 @ 100) = 300 + 250 (previous amount) = 550
                    assert.equal(delegatorInfo.bondedAmount.toString(), '100000000000000000550', 'bonded amount wrong')
                    assert.equal(exchangeRate.toString(), '10000000000000000055000000000', 'exchange rate wrong')
                    assert.equal(stakerBalance.toString(), '100000000000000000550', 'staker balance wrong')
                    await commonAssertions()
                })
            })
        })
    })

})
