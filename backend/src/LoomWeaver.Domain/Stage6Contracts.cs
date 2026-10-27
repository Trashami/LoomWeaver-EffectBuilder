namespace LoomWeaver.Domain;

public sealed record TablePresenceSeatContract(
    string SeatId,
    string DisplayName,
    string Role,
    string BoundCharacter,
    string Status,
    string ActiveRoute,
    int LatencyMs
);

public sealed record TableRealtimeEventContract(
    string EventId,
    int CampaignId,
    string EventType,
    string ActorName,
    string Summary,
    string PayloadJson,
    DateTimeOffset Timestamp
);

public sealed record PublishRealtimeEventRequest(
    string EventType,
    string ActorName,
    string Summary,
    string? PayloadJson
);

public sealed record UserAccountProfileContract(
    string AccountId,
    string Username,
    string DisplayName,
    string Email,
    string Role,
    string TierCode,
    string BoundCharacter,
    IReadOnlyList<string> OwnedAssetIds,
    double CreatorBalanceUsd
);

public sealed record AuthLoginRequest(
    string? Identifier,
    string? AccountId,
    string? Password,
    string? PasswordOrPin
);

public sealed record AuthGoogleLoginRequest(
    string IdToken
);

public sealed record AuthAccountRequestDto(
    string Email,
    string Username,
    string? DisplayName,
    string? Notes
);

public sealed record AuthRegisterRequest(
    string Email,
    string DisplayName,
    string? Username,
    string? Password,
    string? Role
);

public sealed record AuthSessionResponse(
    string Token,
    DateTimeOffset ExpiresAt,
    UserAccountProfileContract Profile,
    object? User = null
);

public sealed record StripeCheckoutRequest(
    string AccountId,
    string ItemId,
    string ItemTitle,
    string CreatorHandle,
    double PriceUsd
);

public sealed record StripeCheckoutSettlementResponse(
    string SessionId,
    string PaymentStatus,
    string ItemId,
    string ItemTitle,
    double GrossAmountUsd,
    double CreatorTransferUsd,
    double PlatformFeeUsd,
    string CreatorHandle,
    string ReceiptNumber,
    DateTimeOffset SettledAt
);

public sealed record CompendiumEntryContract(
    string Id,
    string Name,
    string Category,
    string SystemCode,
    string LevelOrTier,
    string ActionEconomy,
    string Summary,
    string MechanicalPayload,
    string? ImagePath = null,
    string? SourceBook = null,
    string? DefaultEffectId = null
);

public sealed record HeightmapSculptRequest(
    string BiomePreset,
    double BrushRadiusMeters,
    double ElevationDelta,
    int RoughnessOctaves,
    double WaterLevelMeters
);

public sealed record HeightmapSculptResponse(
    string SceneId,
    string BiomePreset,
    double BrushRadiusMeters,
    double PeakElevationMeters,
    double WaterLevelMeters,
    int VertexCount,
    string Summary,
    DateTimeOffset UpdatedAt
);

public sealed record ParticleEmitterCurveContract(
    string Id,
    string Name,
    int EmissionRatePerSec,
    int ParticleLifetimeMs,
    double GravityY,
    double ConeAngleDegrees,
    double StartScale,
    double EndScale,
    string BlendMode,
    string ColorStartHex,
    string ColorEndHex
);
