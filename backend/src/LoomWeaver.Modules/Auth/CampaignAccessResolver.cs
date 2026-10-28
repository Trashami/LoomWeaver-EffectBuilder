using Microsoft.AspNetCore.Http;

namespace LoomWeaver.Modules.Auth;

public sealed record ResolvedCampaignAccess(
    long UserId,
    string Email,
    string Username,
    string AccountRole,
    string EffectiveViewerRole,
    bool IsAccountGm,
    bool IsEffectiveGm,
    string BoundCharacterKey
);

public static class CampaignAccessResolver
{
    public static ResolvedCampaignAccess Resolve(HttpContext? context, int campaignId, string? requestedPreviewRole = null)
    {
        var user = context is not null ? AuthAndCheckoutEndpoints.ResolveAuthenticatedUser(context) : null;
        if (user is null)
        {
            var previewAsPlayer = string.Equals(requestedPreviewRole, "players", StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(requestedPreviewRole, "player", StringComparison.OrdinalIgnoreCase);
            var effectiveRole = previewAsPlayer ? "players" : "gm";

            return new ResolvedCampaignAccess(
                0,
                "gm@loom-weaver.com",
                "GameMaster",
                effectiveRole,
                effectiveRole,
                effectiveRole == "gm",
                effectiveRole == "gm",
                effectiveRole == "gm" ? "all-party" : "pc-dal"
            );
        }

        // Per-Campaign GM vs. Player resolution:
        // A user can be DM/GM in their own campaign and a Player in another DM's campaign.
        var isCampaignGm = IsUserGmForCampaign(user, campaignId);

        // A player in a campaign can NEVER escalate to GM via query parameters or request body.
        // The campaign's DM/GM can down-scope to "players" when using the "Player View" preview toggle.
        var wantsPlayerPreview = string.Equals(requestedPreviewRole, "players", StringComparison.OrdinalIgnoreCase) ||
                                 string.Equals(requestedPreviewRole, "player", StringComparison.OrdinalIgnoreCase);

        var isEffectiveGm = isCampaignGm && !wantsPlayerPreview;
        var effectiveViewerRole = isEffectiveGm ? "gm" : "players";

        var boundChar = isEffectiveGm
            ? "all-party"
            : ResolvePlayerCharacterForUser(user);

        return new ResolvedCampaignAccess(
            user.Id,
            user.Email,
            user.Username,
            isCampaignGm ? "gm" : "players",
            effectiveViewerRole,
            isCampaignGm,
            isEffectiveGm,
            boundChar
        );
    }

    public static bool IsUserGmForCampaign(StoredUserRecord user, int campaignId)
    {
        var uname = (user.Username ?? string.Empty).Trim();
        var accId = (user.AccountId ?? string.Empty).Trim();

        return campaignId switch
        {
            1 => user.Id is 1 or 2 ||
                 uname.Equals("GeoJason", StringComparison.OrdinalIgnoreCase) ||
                 uname.Equals("trashami", StringComparison.OrdinalIgnoreCase) ||
                 accId.Equals("acc-gm-geojason", StringComparison.OrdinalIgnoreCase) ||
                 accId.Equals("acc-gm-trashami", StringComparison.OrdinalIgnoreCase),
            2 => user.Id is 4522 or 3 ||
                 uname.Equals("GregMeinert", StringComparison.OrdinalIgnoreCase) ||
                 uname.Equals("ScottBrogan", StringComparison.OrdinalIgnoreCase) ||
                 accId.Equals("acc-gm-greg", StringComparison.OrdinalIgnoreCase) ||
                 accId.Equals("acc-player-dal", StringComparison.OrdinalIgnoreCase),
            3 => user.Id is 5363 or 4 ||
                 uname.Equals("KennethAlexander", StringComparison.OrdinalIgnoreCase) ||
                 uname.Equals("StickHazen", StringComparison.OrdinalIgnoreCase) ||
                 accId.Equals("acc-gm-kenneth", StringComparison.OrdinalIgnoreCase) ||
                 accId.Equals("acc-player-kycius", StringComparison.OrdinalIgnoreCase),
            103 => user.Id == 3 || uname.Equals("ScottBrogan", StringComparison.OrdinalIgnoreCase),
            104 => user.Id == 4 || uname.Equals("StickHazen", StringComparison.OrdinalIgnoreCase),
            105 => user.Id == 4522 || uname.Equals("GregMeinert", StringComparison.OrdinalIgnoreCase),
            _ => string.Equals(user.Role, "gm", StringComparison.OrdinalIgnoreCase)
        };
    }

    public static string ResolvePlayerCharacterForUser(StoredUserRecord user)
    {
        if (!string.IsNullOrWhiteSpace(user.BoundCharacter) &&
            !user.BoundCharacter.Equals("GM", StringComparison.OrdinalIgnoreCase) &&
            !user.BoundCharacter.Equals("None", StringComparison.OrdinalIgnoreCase))
        {
            return NormalizeCharacterKey(user.BoundCharacter);
        }

        if (user.Username.Equals("GeoJason", StringComparison.OrdinalIgnoreCase) ||
            user.AccountId.Equals("acc-gm-geojason", StringComparison.OrdinalIgnoreCase))
        {
            return "pc-ciaran";
        }

        return "pc-dal";
    }

    private static string NormalizeCharacterKey(string raw)
    {
        var clean = raw.Trim();
        if (clean.StartsWith("pc-", StringComparison.OrdinalIgnoreCase)) return clean.ToLowerInvariant();
        if (clean.StartsWith("Dal", StringComparison.OrdinalIgnoreCase)) return "pc-dal";
        if (clean.StartsWith("Ciar", StringComparison.OrdinalIgnoreCase)) return "pc-ciaran";
        if (clean.StartsWith("Fivi", StringComparison.OrdinalIgnoreCase)) return "pc-fivi";
        if (clean.StartsWith("Kildrid", StringComparison.OrdinalIgnoreCase)) return "pc-kildrid";
        if (clean.StartsWith("Kycius", StringComparison.OrdinalIgnoreCase)) return "pc-kycius";
        if (clean.StartsWith("Munk", StringComparison.OrdinalIgnoreCase)) return "pc-munk";
        return clean;
    }
}
