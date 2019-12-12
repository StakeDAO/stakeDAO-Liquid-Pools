pragma solidity 0.4.24;

import "@aragon/templates-shared/contracts/TokenCache.sol";
import "@aragon/templates-shared/contracts/BaseTemplate.sol";
import "./external/TokenWrapper.sol";
import "./external/Rewards.sol";

contract StakeCapitalTemplate is BaseTemplate, TokenCache {

    bytes32 constant internal REWARDS_ID = 0x3ca69801a60916e9222ceb2fa3089b3f66b4e1b3fc49f4a562043d9ec1e5a00b; // rewards.aragonpm.eth
    bytes32 constant internal TOKEN_WRAPPER_ID = 0x1fda7985bca2bed0615ee04a107b3262fe2a24b5ad427f2e8ef191a446d7841b; // token-wrapper.open.aragonpm.eth for local deployment
//    bytes32 constant internal TOKEN_WRAPPER_ID = 0xdab7adb04b01d9a3f85331236b5ce8f5fdc5eecb1eebefb6129bc7ace10de7bd; // token-wrapper.hatch.aragonpm.eth for rinkeby/mainnet deployment

    string constant private ERROR_EMPTY_HOLDERS = "COMPANY_EMPTY_HOLDERS";
    string constant private ERROR_BAD_HOLDERS_STAKES_LEN = "COMPANY_BAD_HOLDERS_STAKES_LEN";
    string constant private ERROR_BAD_VOTE_SETTINGS = "COMPANY_BAD_VOTE_SETTINGS";
    string constant private ERROR_MISSING_TOKEN_CACHE = "TEMPLATE_MISSING_TOKEN_CACHE";

    bool constant private TOKEN_TRANSFERABLE = true;
    uint8 constant private TOKEN_DECIMALS = uint8(18);
    uint256 constant private TOKEN_MAX_PER_ACCOUNT = uint256(0);

    struct DeployedContracts {
        address teamToken;
        address stakersToken;
    }

    mapping (address => DeployedContracts) private deployedContracts;

    constructor(DAOFactory _daoFactory, ENS _ens, MiniMeTokenFactory _miniMeFactory, IFIFSResolvingRegistrar _aragonID)
        BaseTemplate(_daoFactory, _ens, _miniMeFactory, _aragonID)
        public
    {
        _ensureAragonIdIsValid(_aragonID);
        _ensureMiniMeFactoryIsValid(_miniMeFactory);
    }

    /**
    * @dev Create a new MiniMe token and cache it for the user
    * @param _teamTokenName String with the name for the token used by team member in the organization
    * @param _teamTokenSymbol String with the symbol for the token used by team members in the organization
    * @param _stakersTokenName String with the name for the token used by stakers in the organization
    * @param _stakersTokenSymbol String with the symbol for the token used by stakers in the organization
    */
    function newTokens(
        string memory _teamTokenName,
        string memory _teamTokenSymbol,
        string memory _stakersTokenName,
        string memory _stakersTokenSymbol
    )
        public returns (MiniMeToken, MiniMeToken)
    {
        MiniMeToken teamToken = _createToken(_teamTokenName, _teamTokenSymbol, TOKEN_DECIMALS);
        MiniMeToken stakersToken = _createToken(_stakersTokenName, _stakersTokenSymbol, TOKEN_DECIMALS);
        _storeTokens(teamToken, stakersToken, msg.sender);
        return (teamToken, stakersToken);
    }

    /**
    * @dev Deploy a Company DAO using a previously cached MiniMe token
    * @param _id String with the name for org, will assign `[id].aragonid.eth`
    * @param _holders Array of token holder addresses
    * @param _stakes Array of token stakes for holders (token has 18 decimals, multiply token amount `* 10^18`)
    * @param _teamVotingSettings Array of [supportRequired, minAcceptanceQuorum, voteDuration] to set up the team voting app of the organization
    * @param _stakerVotingSettings Array of [supportRequired, minAcceptanceQuorum, voteDuration] to set up the staker voting app of the organization
    */
    function newInstance(
        string memory _id,
        address[] memory _holders,
        uint256[] memory _stakes,
        uint64[3] memory _teamVotingSettings,
        uint64[3] memory _stakerVotingSettings,
        ERC20 _sctToken
    )
        public
    {
        _validateId(_id);
        _ensureCompanySettings(_holders, _stakes, _teamVotingSettings, _stakerVotingSettings);

        (Kernel dao, ACL acl) = _createDAO();
        (Voting teamVoting, TokenManager tokenManager) = _setupApps(dao, acl, _holders, _stakes, _teamVotingSettings, _stakerVotingSettings);
        setupTokenWrapper(dao, acl, _sctToken, teamVoting);
        setupVaultAndRewards(dao, acl, teamVoting, tokenManager);

        _transferRootPermissionsFromTemplateAndFinalizeDAO(dao, teamVoting);
        _registerID(_id, dao);
        _deleteStoredTokens(msg.sender);
    }

    // TODO: These 2 functions are separated from the others due to a stackTooDeep error. Consider rearranging for consistency.
    function setupTokenWrapper(Kernel _dao, ACL _acl, ERC20 _sctToken, Voting _teamVoting) internal {
        (, MiniMeToken stakersToken) = _retrieveStoredTokens(msg.sender);

        TokenWrapper tokenWrapper = TokenWrapper(_installNonDefaultApp(_dao, TOKEN_WRAPPER_ID));
        stakersToken.changeController(address(tokenWrapper));
        tokenWrapper.initialize(stakersToken, _sctToken);

        _acl.createPermission(address(-1), tokenWrapper, bytes32(-1), _teamVoting);
    }

    function setupVaultAndRewards(Kernel _dao, ACL _acl, address _teamVoting, address _tokenManager) internal {
        Vault vault = _installVaultApp(_dao);

        bytes memory initializeData = abi.encodeWithSelector(Rewards(0).initialize.selector, vault);
        Rewards rewards = Rewards(_installNonDefaultApp(_dao, REWARDS_ID, initializeData));
        _acl.createPermission(_tokenManager, rewards, rewards.ADD_REWARD_ROLE(), _teamVoting);

        _createVaultPermissions(_acl, vault, _teamVoting, address(rewards));
    }

    function _setupApps(
        Kernel _dao,
        ACL _acl,
        address[] memory _holders,
        uint256[] memory _stakes,
        uint64[3] memory _teamVotingSettings,
        uint64[3] memory _stakerVotingSettings
    )
        internal
        returns (Voting, TokenManager)
    {
        (MiniMeToken teamToken, MiniMeToken stakersToken) = _retrieveStoredTokens(msg.sender);
        Agent agent = _installDefaultAgentApp(_dao);
        TokenManager tokenManager = _installTokenManagerApp(_dao, teamToken, TOKEN_TRANSFERABLE, TOKEN_MAX_PER_ACCOUNT);
        Voting teamVoting = _installVotingApp(_dao, teamToken, _teamVotingSettings);
        Voting stakerVoting = _installVotingApp(_dao, stakersToken, _stakerVotingSettings);

        _mintTokens(_acl, tokenManager, _holders, _stakes);
        _setupPermissions(_acl, agent, teamVoting, stakerVoting, tokenManager);

        return (teamVoting, tokenManager);
    }

    function _setupPermissions(
        ACL _acl,
        Agent _agent,
        Voting _teamVoting,
        Voting _stakerVoting,
        TokenManager _tokenManager
    )
        internal
    {
        _createAgentPermissions(_acl, _agent, _teamVoting, _teamVoting);
        _createEvmScriptsRegistryPermissions(_acl, _teamVoting, _teamVoting);
        _createVotingPermissions(_acl, _teamVoting, _teamVoting, _tokenManager, _teamVoting);
        _createVotingPermissions(_acl, _stakerVoting, _teamVoting, _tokenManager, _teamVoting);
        _createTokenManagerPermissions(_acl, _tokenManager, _teamVoting, _teamVoting);
        _acl.createPermission(_teamVoting, _tokenManager, _tokenManager.ASSIGN_ROLE(), _teamVoting);
    }

    function _ensureCompanySettings(
        address[] memory _holders,
        uint256[] memory _stakes,
        uint64[3] memory _teamVotingSettings,
        uint64[3] memory _stakerVotingSettings
    )
        private pure
    {
        require(_holders.length > 0, ERROR_EMPTY_HOLDERS);
        require(_holders.length == _stakes.length, ERROR_BAD_HOLDERS_STAKES_LEN);
        require(_teamVotingSettings.length == 3, ERROR_BAD_VOTE_SETTINGS);
        require(_stakerVotingSettings.length == 3, ERROR_BAD_VOTE_SETTINGS);
    }

    function _storeTokens(MiniMeToken _teamToken, MiniMeToken _stakersToken, address _owner) internal {
        deployedContracts[_owner].teamToken = _teamToken;
        deployedContracts[_owner].stakersToken = _stakersToken;
    }

    function _retrieveStoredTokens(address _owner) internal returns (MiniMeToken, MiniMeToken) {
        require(deployedContracts[_owner].teamToken != address(0), ERROR_MISSING_TOKEN_CACHE);
        DeployedContracts memory ownerDeployedContracts = deployedContracts[_owner];
        return (MiniMeToken(ownerDeployedContracts.teamToken), MiniMeToken(ownerDeployedContracts.stakersToken));
    }

    function _deleteStoredTokens(address _owner) internal {
        delete deployedContracts[_owner];
    }
}
