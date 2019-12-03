import Fixture from '../../livepeer-protocol/test/unit/helpers/Fixture'

const ERC20Mintable = artifacts.require('ERC20Mintable')
const LivepeerAllocationStrategy = artifacts.require('LivepeerAllocationStrategy')
const RToken = artifacts.require('RToken')
const BondingManager = artifacts.require('BondingManager')
const SortedDoublyLL = artifacts.require('SortedDoublyLL')

const { toWad } = require('@decentral.ee/web3-test-helpers')
import { functionSig } from '../../livepeer-protocol/utils/helpers'

contract('RToken using LivepeerAllocationStrategy', ([admin, staker, stakeCapitalTranscoder]) => {

    const NUM_TRANSCODERS = 5
    const NUM_ACTIVE_TRANSCODERS = 2
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20

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
            .new(livepeerToken.address, bondingManager.address, stakeCapitalTranscoder)

        rToken = await RToken.new()
        await rToken.initialize(livepeerAllocationStrategy.address, 'RToken Test', 'RTOKEN', 18)

        await livepeerAllocationStrategy.transferOwnership(rToken.address)
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("mint(uint256 mintAmount)", async () => {

        it('updates exchange rate as expected and bonds', async () => {
            await fixture.roundsManager.setMockBool(functionSig('currentRoundInitialized()'), true)
            await fixture.roundsManager.setMockBool(functionSig('currentRoundLocked()'), false)
            await fixture.roundsManager.setMockUint256(functionSig('currentRound()'), 100)

            await livepeerToken.approve(rToken.address, toWad(100), { from: stakeCapitalTranscoder })
            await bondingManager.bond(toWad(100), stakeCapitalTranscoder, { from: stakeCapitalTranscoder })
            await bondingManager.transcoder(5, 10, 1, { from: stakeCapitalTranscoder })

            await livepeerToken.approve(rToken.address, toWad(100), { from: staker })
            await rToken.mint(toWad(100), { from: staker })

            const delegatorInfo = await bondingManager.getDelegator(livepeerAllocationStrategy.address)

            assert.equal(await livepeerAllocationStrategy.exchangeRateStored(), 1);
            assert.equal(delegatorInfo.bondedAmount.toString(), toWad(100).toString())
        })
    })

})
