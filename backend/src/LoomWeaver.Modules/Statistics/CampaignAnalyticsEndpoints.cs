using LoomWeaver.Domain;
using LoomWeaver.Modules.Characters;
using LoomWeaver.Modules.Dice;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace LoomWeaver.Modules.Statistics;

public static class CampaignAnalyticsEndpoints
{
    public static RouteGroupBuilder MapCampaignAnalyticsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/campaigns/{campaignId:int}/analytics", (int campaignId) =>
        {
            var recentRolls = DiceForgeEndpoints.GetRecentRolls();
            var sheetStats = CharacterSheetLiveTelemetryEndpoints.GetAllTelemetry();
            var d20Rolls = recentRolls
                .Where(r => r.Sides == 20)
                .SelectMany(r => r.KeptRolls)
                .ToList();

            var baseRollCount = sheetStats.Sum(s => s.TotalSessionRolls) + recentRolls.Count;
            var nat20Count = sheetStats.Sum(s => s.Nat20Count) + recentRolls.Count(r => r.IsNat20);
            var nat1Count = sheetStats.Sum(s => s.CritFailCount) + recentRolls.Count(r => r.IsNat1);
            var avgD20 = d20Rolls.Count > 0
                ? Math.Round((11.4 * 20 + d20Rolls.Average()) / 21.0, 2)
                : 11.42;

            var partyRadar = new[]
            {
                new RadarMetricContract("Tactical Combat", 92),
                new RadarMetricContract("Lore & Investigation", 86),
                new RadarMetricContract("Roleplay & Intrigue", 84),
                new RadarMetricContract("Exploration & Travel", 79),
                new RadarMetricContract("Action Economy", 91),
                new RadarMetricContract("Resource Survival", 77)
            };

            var characters = new[]
            {
                new CharacterTelemetryContract(
                    "char-dal",
                    "Dal",
                    "Edhellainian Ranger / Heir in Exile",
                    486,
                    140,
                    95,
                    9,
                    38,
                    19,
                    new[]
                    {
                        new RadarMetricContract("Combat", 88),
                        new RadarMetricContract("Lore", 82),
                        new RadarMetricContract("Roleplay", 79),
                        new RadarMetricContract("Perception", 96),
                        new RadarMetricContract("Stealth", 94),
                        new RadarMetricContract("Survival", 90)
                    }
                ),
                new CharacterTelemetryContract(
                    "char-fivi",
                    "Fivi",
                    "Feywild Outcast / Arcane Trickster",
                    418,
                    85,
                    162,
                    11,
                    42,
                    15,
                    new[]
                    {
                        new RadarMetricContract("Combat", 84),
                        new RadarMetricContract("Lore", 76),
                        new RadarMetricContract("Roleplay", 95),
                        new RadarMetricContract("Chaos Logic", 99),
                        new RadarMetricContract("Stealth", 91),
                        new RadarMetricContract("Survival", 72)
                    }
                ),
                new CharacterTelemetryContract(
                    "char-kildrid",
                    "Kildrid",
                    "Dwarven Stone-Scholar & Runesmith",
                    342,
                    390,
                    284,
                    5,
                    35,
                    24,
                    new[]
                    {
                        new RadarMetricContract("Combat", 78),
                        new RadarMetricContract("Lore", 98),
                        new RadarMetricContract("Roleplay", 82),
                        new RadarMetricContract("Stone Sense", 99),
                        new RadarMetricContract("Defense", 92),
                        new RadarMetricContract("Survival", 86)
                    }
                ),
                new CharacterTelemetryContract(
                    "char-kycius",
                    "Kycius",
                    "Spellblade & Seeker of Lost Truth",
                    452,
                    175,
                    148,
                    8,
                    39,
                    21,
                    new[]
                    {
                        new RadarMetricContract("Combat", 90),
                        new RadarMetricContract("Lore", 91),
                        new RadarMetricContract("Roleplay", 88),
                        new RadarMetricContract("Insight", 95),
                        new RadarMetricContract("Arcana", 93),
                        new RadarMetricContract("Survival", 78)
                    }
                ),
                new CharacterTelemetryContract(
                    "char-munk",
                    "Munk",
                    "Frontline Vanguard & Shield-Breaker",
                    614,
                    520,
                    64,
                    10,
                    41,
                    9,
                    new[]
                    {
                        new RadarMetricContract("Combat", 98),
                        new RadarMetricContract("Lore", 62),
                        new RadarMetricContract("Roleplay", 80),
                        new RadarMetricContract("Vanguard", 97),
                        new RadarMetricContract("Endurance", 96),
                        new RadarMetricContract("Survival", 89)
                    }
                )
            };

            var damageBreakdown = new[]
            {
                new DamageTypeBreakdownContract("Slashing & Piercing", "#e5b85c", 894, 38, 46, "Munk Greatsword Cleave & Dal Longbow"),
                new DamageTypeBreakdownContract("Radiant & Luminary", "#ffd97d", 542, 23, 58, "Kildrid Rune Ward & Well of Life Echo"),
                new DamageTypeBreakdownContract("Fire & Drake Breath", "#ff6b4a", 398, 17, 39, "Kycius & Laksis Ignition Arc"),
                new DamageTypeBreakdownContract("Force & Fey Slingshot", "#70d6ff", 305, 13, 44, "Fivi Slingshot Tooth Critical"),
                new DamageTypeBreakdownContract("Necrotic & Shadow", "#b87cff", 173, 9, 31, "Cinth Vampire Counter-Ward")
            };

            var achievements = new[]
            {
                new CampaignAchievementContract(
                    "ach-tooth-slingshot",
                    "Tooth of the Mountain",
                    "Land the final killing blow on an ancient bound dragon using a slingshot loaded with a tooth.",
                    "Mythic Feat",
                    "Mythic",
                    "Bolt",
                    1,
                    1,
                    true,
                    "Fivi",
                    1500
                ),
                new CampaignAchievementContract(
                    "ach-cinth-masquerade",
                    "Velvet & Fangs Unmasked",
                    "Survive the Lord of Cinth's masquerade ambush and expose the vampire coven's bid for the city.",
                    "Story Milestone",
                    "Gold",
                    "Shield",
                    1,
                    1,
                    true,
                    "Full Party",
                    1200
                ),
                new CampaignAchievementContract(
                    "ach-artificer-compact",
                    "Engines Against Eternity",
                    "Forge an alliance with the Cinth Artificers Guild and inspect Kutler's skyship.",
                    "Faction Accord",
                    "Arcane",
                    "Wrench",
                    1,
                    1,
                    true,
                    "Kildrid & Kycius",
                    850
                ),
                new CampaignAchievementContract(
                    "ach-dolly-pocket",
                    "The Quiet Maw",
                    "Sew an extradimensional containment pocket inside Dolly's mouth along the road to Cinth.",
                    "Companion Craft",
                    "Gold",
                    "Compass",
                    1,
                    1,
                    true,
                    "Kycius & Fivi",
                    500
                ),
                new CampaignAchievementContract(
                    "ach-edhellain-lineage",
                    "Pages of the True Crown",
                    "Recover the missing pages in Edhellain revealing Dal's royal lineage (Book Two Progression).",
                    "Chronicle Arc",
                    "Mythic",
                    "BookOpen",
                    2,
                    3,
                    false,
                    "Dal",
                    2000
                )
            };

            return Results.Ok(new CampaignAnalyticsDashboardContract(
                campaignId,
                "Shadow of the Mountain — Book I & II Chronicle",
                18,
                14,
                28450,
                baseRollCount,
                nat20Count,
                nat1Count,
                avgD20,
                partyRadar,
                characters,
                damageBreakdown,
                achievements,
                recentRolls
            ));
        });

        return api;
    }
}
