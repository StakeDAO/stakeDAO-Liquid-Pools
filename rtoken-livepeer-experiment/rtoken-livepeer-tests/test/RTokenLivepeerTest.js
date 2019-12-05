import Fixture from '../../livepeer-protocol/test/unit/helpers/Fixture'

const ERC20Mintable = artifacts.require('ERC20Mintable')
const LivepeerAllocationStrategy = artifacts.require('LivepeerAllocationStrategy')
const RToken = artifacts.require('RToken')
const BondingManager = artifacts.require('BondingManager')
const SortedDoublyLL = artifacts.require('SortedDoublyLL')

const { toWad, wad4human } = require('@decentral.ee/web3-test-helpers')
import { functionSig, functionEncodedABI } from '../../livepeer-protocol/utils/helpers'

contract('RToken using LivepeerAllocationStrategy', ([admin, staker, stakeCapitalTranscoder]) => {

    const NUM_TRANSCODERS = 5
    const NUM_ACTIVE_TRANSCODERS = 2
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20
    const PERC_MULTIPLIER = 10000

    let fixture
    let livepeerToken, livepeerAllocationStrategy, rToken, bondingManager

    before(async () => {
        fixture = new Fixture(web3)
        await fixture.deploy()

        await deployLinkedList()
        bondingManager = await fixture.deployAndRegister(BondingManager, 'BondingManager', fixture.controller.address)
        await setupBondingManager()

    })

    async function deployLinkedList() {
        const sortedDoublyLL = await SortedDoublyLL.new()
        await BondingManager.link('SortedDoublyLL', sortedDoublyLL.address)
    }

    async function setupBondingManager() {
        await bondingManager.setUnbondingPeriod(UNBONDING_PERIOD)
        await bondingManager.setNumTranscoders(NUM_TRANSCODERS)
        await bondingManager.setNumActiveTranscoders(NUM_ACTIVE_TRANSCODERS)
        await bondingManager.setMaxEarningsClaimsRounds(MAX_EARNINGS_CLAIMS_ROUNDS)
    }

    beforeEach(async () => {
        await fixture.setUp()

        livepeerToken = await ERC20Mintable.new()
        await livepeerToken.mint(staker, toWad(1000))

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
        let accountName;
        if (account === admin) accountName = "admin";
        else if (account === staker) accountName = "staker";

        const tokenBalance = await rToken.balanceOf.call(account)
        console.log(`\n${accountName} tokenBalance ${tokenBalance}`);

        const receivedLoan = await rToken.receivedLoanOf.call(account)
        console.log(`${accountName} receivedLoan ${receivedLoan}`);

        const receivedSavings = await rToken.receivedSavingsOf.call(account)
        console.log(`${accountName} receivedSavings ${receivedSavings}`);

        const interestPayable = await rToken.interestPayableOf.call(account)
        console.log(`${accountName} interestPayable ${interestPayable}`);

        const accountStats = await rToken.getAccountStats.call(account);

        const cumulativeInterest = accountStats.cumulativeInterest;
        console.log(`${accountName} cumulativeInterest ${cumulativeInterest}`);

        const rInterest = accountStats.rInterest;
        console.log(`${accountName} rInterest ${rInterest}`);

        const sInternalAmount = accountStats.sInternalAmount;
        console.log(`${accountName} sInternalAmount ${sInternalAmount}`);

        const lDebt = accountStats.lDebt;
        console.log(`${accountName} lDebt ${lDebt}`);

        const rAmount = accountStats.rAmount;
        console.log(`${accountName} rAmount ${rAmount}`);
    }

    describe('mint(uint256 mintAmount)', async () => {

        const currentRound = 100

        beforeEach(async () => {
            await fixture.roundsManager.setMockBool(functionSig('currentRoundInitialized()'), true)
            await fixture.roundsManager.setMockBool(functionSig('currentRoundLocked()'), false)
            await fixture.roundsManager.setMockUint256(functionSig('currentRound()'), currentRound)

            await livepeerToken.approve(rToken.address, toWad(100), { from: stakeCapitalTranscoder })
            await bondingManager.bond(toWad(100), stakeCapitalTranscoder, { from: stakeCapitalTranscoder })
            await bondingManager.transcoder(50 * PERC_MULTIPLIER, 10 * PERC_MULTIPLIER, 100, { from: stakeCapitalTranscoder })

            await livepeerToken.approve(rToken.address, toWad(100), { from: staker })
            await rToken.mint(toWad(100), { from: staker })
        })

        it('updates exchange rate, bonds and updates user rtoken balance', async () => {
            const delagatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)

            assert.equal((await rToken.balanceOf(staker)).toString(), toWad(100).toString())
            assert.equal((await livepeerAllocationStrategy.exchangeRateStored()).toString(), toWad(1).toString())
            assert.equal(delagatorInfo.bondedAmount.toString(), toWad(100).toString())
        })

        describe('reward()', async () => {

            beforeEach(async () => {
                await fixture.roundsManager.setMockUint256(functionSig('currentRound()'), currentRound + 1)
                await fixture.roundsManager.execute(bondingManager.address, functionSig('setActiveTranscoders()'))
                await fixture.jobsManager.execute(
                    bondingManager.address,
                    functionEncodedABI(
                        "updateTranscoderWithFees(address,uint256,uint256)",
                        ["address", "uint256", "uint256"],
                        [stakeCapitalTranscoder, 1000, currentRound + 1]
                    )
                )
                await fixture.minter.setMockUint256(functionSig('createReward(uint256,uint256)'), 1000)
            })

            it('accrues interest for staker', async () => {
                await bondingManager.reward({ from: stakeCapitalTranscoder })

                console.log("Balance of staker: " + await rToken.balanceOf(staker))
                console.log("Delegator info: ", await bondingManager.getDelegator(livepeerAllocationStrategy.address))

                console.log(`Exchange rate: ` + await livepeerAllocationStrategy.exchangeRateStored())

                await printAccount(staker)

                await rToken.payInterest(staker)

                await printAccount(staker)

                console.log("Balance of staker: " + await rToken.balanceOf(staker))
                console.log("Delegator info: ", await bondingManager.getDelegator(livepeerAllocationStrategy.address))

                console.log(`Exchange rate: ` + await livepeerAllocationStrategy.exchangeRateStored())


                assert.fail()
            })
        })
    })

})
