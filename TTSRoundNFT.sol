// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Self-contained ERC721 — no external imports.
// Each token represents a Temptation Token round winner.
// Metadata is stored fully on-chain as a JSON data URI.

contract TTSRoundNFT {

    // ── ERC165 ─────────────────────────────────────────────────────────────────
    bytes4 private constant _ERC165_ID  = 0x01ffc9a7;
    bytes4 private constant _ERC721_ID  = 0x80ac58cd;
    bytes4 private constant _META_ID    = 0x5b5e139f; // ERC721Metadata

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == _ERC165_ID || id == _ERC721_ID || id == _META_ID;
    }

    // ── ERC721 storage ─────────────────────────────────────────────────────────
    string public name   = "TTS Round Winner";
    string public symbol = "TTSW";

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner_) external view returns (uint256) {
        require(owner_ != address(0), "Zero address");
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "Not minted");
        return o;
    }

    function approve(address to, uint256 tokenId) external {
        address o = ownerOf(tokenId);
        require(msg.sender == o || _operatorApprovals[o][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(o, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "Not minted");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner_, address operator) external view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address o = ownerOf(tokenId);
        require(o == from, "Wrong owner");
        require(to != address(0), "Zero address");
        require(
            msg.sender == o ||
            _tokenApprovals[tokenId] == msg.sender ||
            _operatorApprovals[o][msg.sender],
            "Not authorized"
        );
        delete _tokenApprovals[tokenId];
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            bytes4 ret = IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data);
            require(ret == bytes4(keccak256("onERC721Received(address,address,uint256,bytes)")), "Unsafe receiver");
        }
    }

    // ── Winner metadata ────────────────────────────────────────────────────────
    struct WinnerData {
        uint256 roundId;
        string  winnerProfile;
        uint256 voteCount;
        uint256 date; // Unix timestamp of settlement
    }

    mapping(uint256 => WinnerData) private _metadata;
    uint256 private _nextId = 1;

    // ── Access control ─────────────────────────────────────────────────────────
    address public owner;
    address public minter; // voting contract or admin

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyMinter() { require(msg.sender == minter || msg.sender == owner, "Not minter"); _; }

    event OwnershipTransferred(address indexed prev, address indexed next);

    constructor() {
        owner  = msg.sender;
        minter = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setMinter(address newMinter) external onlyOwner {
        minter = newMinter;
    }

    // ── Mint ───────────────────────────────────────────────────────────────────
    event Minted(uint256 indexed tokenId, uint256 roundId, string winnerProfile, address to);

    function mint(
        address to,
        uint256 roundId,
        string calldata winnerProfile,
        uint256 voteCount
    ) external onlyMinter returns (uint256 tokenId) {
        require(to != address(0), "Zero address");
        tokenId = _nextId++;
        _owners[tokenId] = to;
        _balances[to]++;
        _metadata[tokenId] = WinnerData(roundId, winnerProfile, voteCount, block.timestamp);
        emit Transfer(address(0), to, tokenId);
        emit Minted(tokenId, roundId, winnerProfile, to);
    }

    // ── On-chain metadata ──────────────────────────────────────────────────────
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Not minted");
        WinnerData memory d = _metadata[tokenId];

        string memory json = string(abi.encodePacked(
            '{"name":"TTS Round #', _toString(d.roundId), ' Winner",',
            '"description":"Temptation Token on-chain round winner certificate.",',
            '"attributes":[',
                '{"trait_type":"Round","value":', _toString(d.roundId), '},',
                '{"trait_type":"Winner Profile","value":"', d.winnerProfile, '"},',
                '{"trait_type":"Vote Count","value":', _toString(d.voteCount / 1e18), '},',
                '{"trait_type":"Settlement Date","display_type":"date","value":', _toString(d.date),'}',
            '],',
            '"image":"data:image/svg+xml;base64,', _buildSVG(d), '"}'
        ));

        return string(abi.encodePacked(
            'data:application/json;base64,',
            _base64Encode(bytes(json))
        ));
    }

    function getMetadata(uint256 tokenId) external view returns (
        uint256 roundId, string memory winnerProfile, uint256 voteCount, uint256 date
    ) {
        WinnerData memory d = _metadata[tokenId];
        return (d.roundId, d.winnerProfile, d.voteCount, d.date);
    }

    function totalSupply() external view returns (uint256) { return _nextId - 1; }

    // ── SVG builder ────────────────────────────────────────────────────────────
    function _buildSVG(WinnerData memory d) internal pure returns (string memory) {
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">',
            '<rect width="400" height="400" fill="#0d0d0d"/>',
            '<text x="200" y="80" text-anchor="middle" font-family="monospace" font-size="36" fill="#ffd700">TTS</text>',
            '<text x="200" y="120" text-anchor="middle" font-family="monospace" font-size="14" fill="#888">ROUND WINNER</text>',
            '<text x="200" y="190" text-anchor="middle" font-family="monospace" font-size="48" fill="#ffd700">#', _toString(d.roundId), '</text>',
            '<text x="200" y="240" text-anchor="middle" font-family="monospace" font-size="13" fill="#ccc">', _truncate(d.winnerProfile, 24), '</text>',
            '<text x="200" y="275" text-anchor="middle" font-family="monospace" font-size="12" fill="#888">', _toString(d.voteCount / 1e18), ' TTS voted</text>',
            '<text x="200" y="350" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">temptationtoken.io</text>',
            '</svg>'
        );
        return _base64Encode(svg);
    }

    // ── Utilities ──────────────────────────────────────────────────────────────
    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 len;
        while (tmp != 0) { len++; tmp /= 10; }
        bytes memory buf = new bytes(len);
        while (v != 0) { buf[--len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }

    function _truncate(string memory s, uint256 maxLen) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= maxLen) return s;
        bytes memory out = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) out[i] = b[i];
        return string(out);
    }

    // Standard base64 encoder
    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        bytes memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen);
        uint256 i = 0; uint256 j = 0;
        for (; i + 2 < data.length; i += 3) {
            uint256 a = uint8(data[i]); uint256 b = uint8(data[i+1]); uint256 c = uint8(data[i+2]);
            result[j++] = TABLE[(a >> 2) & 0x3F];
            result[j++] = TABLE[((a << 4) | (b >> 4)) & 0x3F];
            result[j++] = TABLE[((b << 2) | (c >> 6)) & 0x3F];
            result[j++] = TABLE[c & 0x3F];
        }
        if (i + 1 == data.length) {
            uint256 a = uint8(data[i]);
            result[j++] = TABLE[(a >> 2) & 0x3F];
            result[j++] = TABLE[(a << 4) & 0x3F];
            result[j++] = "="; result[j++] = "=";
        } else if (i + 2 == data.length) {
            uint256 a = uint8(data[i]); uint256 b = uint8(data[i+1]);
            result[j++] = TABLE[(a >> 2) & 0x3F];
            result[j++] = TABLE[((a << 4) | (b >> 4)) & 0x3F];
            result[j++] = TABLE[(b << 2) & 0x3F];
            result[j++] = "=";
        }
        return string(result);
    }
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}
