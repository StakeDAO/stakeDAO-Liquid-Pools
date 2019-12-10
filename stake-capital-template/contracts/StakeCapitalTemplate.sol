pragma solidity 0.4.24;

import "@aragon/templates-shared/contracts/TokenCache.sol";
import "@aragon/templates-shared/contracts/BaseTemplate.sol";


contract StakeCapitalTemplate is BaseTemplate, TokenCache {
    string constant private ERROR_EMPTY_HOLDERS = "COMPANY_EMPTY_HOLDERS";
    string constant private ERROR_BAD_HOLDERS_STAKES_LEN = "COMPANY_BAD_HOLDERS_STAKES_LEN";
    string constant private ERROR_BAD_VOTE_SETTINGS = "COMPANY_BAD_VOTE_SETTINGS";

    bool constant private TOKEN_TRANSFERABLE = true;
    uint8 constant private TOKEN_DECIMALS = uint8(18);
    uint256 constant private TOKEN_MAX_PER_ACCOUNT = uint256(0);

    constructor(DAOFactory _daoFactory, ENS _ens, MiniMeTokenFactory _miniMeFactory, IFIFSResolvingRegistrar _aragonID)
        BaseTemplate(_daoFactory, _ens, _miniMeFactory, _aragonID)
        public
    {
        _ensureAragonIdIsValid(_aragonID);
        _ensureMiniMeFactoryIsValid(_miniMeFactory);
    }

    /**
    * @dev Create a new MiniMe token and deploy a Company DAO.
    * @param _tokenName String with the name for the token used by share holders in the organization
    * @param _tokenSymbol String with the symbol for the token used by share holders in the organization
    * @param _id String with the name for org, will assign `[id].aragonid.eth`
    * @param _holders Array of token holder addresses
    * @param _stakes Array of token stakes for holders (token has 18 decimals, multiply token amount `* 10^18`)
    * @param _votingSettings Array of [supportRequired, minAcceptanceQuorum, voteDuration] to set up the voting app of the organization
    * @param _useAgentAsVault Boolean to tell whether to use an Agent app as a more advanced form of Vault app
    */
    function newTokenAndInstance(
        string _tokenName,
        string _tokenSymbol,
        string _id,
        address[] _holders,
        uint256[] _stakes,
        uint64[3] _votingSettings,
        bool _useAgentAsVault
    )
        external
    {
        newToken(_tokenName, _tokenSymbol);
        newInstance(_id, _holders, _stakes, _votingSettings, _useAgentAsVault);
    }

    /**
    * @dev Create a new MiniMe token and cache it for the user
    * @param _name String with the name for the token used by share holders in the organization
    * @param _symbol String with the symbol for the token used by share holders in the organization
    */
    function newToken(string memory _name, string memory _symbol) public returns (MiniMeToken) {
        MiniMeToken token = _createToken(_name, _symbol, TOKEN_DECIMALS);
        _cacheToken(token, msg.sender);
        return token;
    }

    /**
    * @dev Deploy a Company DAO using a previously cached MiniMe token
    * @param _id String with the name for org, will assign `[id].aragonid.eth`
    * @param _holders Array of token holder addresses
    * @param _stakes Array of token stakes for holders (token has 18 decimals, multiply token amount `* 10^18`)
    * @param _votingSettings Array of [supportRequired, minAcceptanceQuorum, voteDuration] to set up the voting app of the organization
    * @param _useAgentAsVault Boolean to tell whether to use an Agent app as a more advanced form of Vault app
    */
    function newInstance(
        string memory _id,
        address[] memory _holders,
        uint256[] memory _stakes,
        uint64[3] memory _votingSettings,
        bool _useAgentAsVault
    )
        public
    {
        _validateId(_id);
        _ensureCompanySettings(_holders, _stakes, _votingSettings);

        (Kernel dao, ACL acl) = _createDAO();
        Voting voting = _setupApps(dao, acl, _holders, _stakes, _votingSettings, _useAgentAsVault);
        _transferRootPermissionsFromTemplateAndFinalizeDAO(dao, voting);
        _registerID(_id, dao);
    }

    function _setupApps(
        Kernel _dao,
        ACL _acl,
        address[] memory _holders,
        uint256[] memory _stakes,
        uint64[3] memory _votingSettings,
        bool _useAgentAsVault
    )
        internal
        returns (Voting)
    {
        MiniMeToken token = _popTokenCache(msg.sender);
        Vault agentOrVault = _useAgentAsVault ? _installDefaultAgentApp(_dao) : _installVaultApp(_dao);
        TokenManager tokenManager = _installTokenManagerApp(_dao, token, TOKEN_TRANSFERABLE, TOKEN_MAX_PER_ACCOUNT);
        Voting voting = _installVotingApp(_dao, token, _votingSettings);

        _mintTokens(_acl, tokenManager, _holders, _stakes);
        _setupPermissions(_acl, agentOrVault, voting, tokenManager, _useAgentAsVault);

        return voting;
    }

    function _setupPermissions(
        ACL _acl,
        Vault _agentOrVault,
        Voting _voting,
        TokenManager _tokenManager,
        bool _useAgentAsVault
    )
        internal
    {
        if (_useAgentAsVault) {
            _createAgentPermissions(_acl, Agent(_agentOrVault), _voting, _voting);
        }
        _createVaultPermissions(_acl, _agentOrVault, _voting, _voting);
        _createEvmScriptsRegistryPermissions(_acl, _voting, _voting);
        _createVotingPermissions(_acl, _voting, _voting, _tokenManager, _voting);
        _createTokenManagerPermissions(_acl, _tokenManager, _voting, _voting);
    }

    function _ensureCompanySettings(address[] memory _holders, uint256[] memory _stakes, uint64[3] memory _votingSettings) private pure {
        require(_holders.length > 0, ERROR_EMPTY_HOLDERS);
        require(_holders.length == _stakes.length, ERROR_BAD_HOLDERS_STAKES_LEN);
        require(_votingSettings.length == 3, ERROR_BAD_VOTE_SETTINGS);
    }
}
