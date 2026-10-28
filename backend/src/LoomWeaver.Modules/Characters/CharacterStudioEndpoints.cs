using LoomWeaver.Domain;
using LoomWeaver.GameSystems;
using LoomWeaver.Modules.Adventures;
using LoomWeaver.Modules.Auth;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace LoomWeaver.Modules.Characters;

public static class CharacterStudioEndpoints
{
    private static readonly CharacterCalculationEngine Engine = new();
    private static readonly List<CharacterSheetDto> Sheets = SeedInitialSheets();

    public static void MapCharacterStudioEndpoints(this IEndpointRouteBuilder group)
    {
        group.MapCharacterSheetLiveTelemetryEndpoints();

        group.MapGet("/campaigns/{campaignId:int}/character-studio", (
            int campaignId,
            string? role,
            HttpContext httpContext) =>
        {
            var access = CampaignAccessResolver.Resolve(httpContext, campaignId, role);
            var campaignSheets = Sheets
                .Where(s => s.CampaignId == campaignId || s.CampaignId == 1)
                .Select(s => Engine.RecalculateSheet(s))
                .ToList();

            if (access.IsEffectiveGm)
            {
                return Results.Ok(campaignSheets);
            }

            var targetSlug = access.BoundCharacterKey.Replace("pc-", "char-", StringComparison.OrdinalIgnoreCase);
            var playerSheet = campaignSheets.FirstOrDefault(s =>
                s.CharacterKey.Equals(targetSlug, StringComparison.OrdinalIgnoreCase) ||
                s.Name.Contains(access.BoundCharacterKey.Replace("pc-", ""), StringComparison.OrdinalIgnoreCase))
                ?? campaignSheets.FirstOrDefault();

            return Results.Ok(playerSheet is not null ? new List<CharacterSheetDto> { playerSheet } : new List<CharacterSheetDto>());
        });

        group.MapPost("/campaigns/{campaignId:int}/character-studio/create", (
            int campaignId,
            CreateCharacterRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name))
            {
                return Results.BadRequest(new { error = "Character name is required." });
            }

            var slug = req.Name.Trim().ToLowerInvariant().Replace(' ', '-');
            var key = $"char-{slug}";
            var compositeKey = $"{campaignId}:Character:{key}";

            var abilities = new List<AbilityScoreDto>
            {
                new("STR", "Strength", req.AbilityScores.GetValueOrDefault("STR", 12), 0),
                new("DEX", "Dexterity", req.AbilityScores.GetValueOrDefault("DEX", 15), 0),
                new("CON", "Constitution", req.AbilityScores.GetValueOrDefault("CON", 14), 0),
                new("INT", "Intelligence", req.AbilityScores.GetValueOrDefault("INT", 13), 0),
                new("WIS", "Wisdom", req.AbilityScores.GetValueOrDefault("WIS", 14), 0),
                new("CHA", "Charisma", req.AbilityScores.GetValueOrDefault("CHA", 12), 0),
            };

            var draft = new CharacterSheetDto(
                CompositeKey: compositeKey,
                CharacterKey: key,
                CampaignId: campaignId,
                Name: req.Name.Trim(),
                AncestryOrClan: req.AncestryOrClan,
                ClassOrArchetype: req.ClassOrArchetype,
                SystemCode: string.IsNullOrWhiteSpace(req.SystemCode) ? "dnd5e" : req.SystemCode,
                Level: Math.Clamp(req.Level, 1, 20),
                CurrentXp: 23000,
                NextLevelXp: 34000,
                LevelUpEligible: false,
                MaxHp: 60,
                CurrentHp: 60,
                ArmorClass: 16,
                InitiativeBonus: 3,
                SpeedFeet: 30,
                ProficiencyBonus: 3,
                ActionEconomySummary: "",
                Abilities: abilities,
                Equipment:
                [
                    new("eq-1", "Cinth Artificer Coat", "Armor", "+2 AC · Reinforced Weave", 2, 0, true),
                    new("eq-2", "Runed Sideblade", "Main Hand", "+1 Attack · Finesse", 0, 1, true)
                ],
                Features:
                [
                    "Campaign Origin: Vandia to Cinth Road",
                    $"Archetype Core: {req.ClassOrArchetype}"
                ]
            );

            var calculated = Engine.RecalculateSheet(draft);
            Sheets.Add(calculated);

            AdventureGuideStateStore.RegisterCharacterOrNpc(
                campaignId,
                $"node-{key}",
                compositeKey,
                calculated.Name,
                $"{calculated.AncestryOrClan} {calculated.ClassOrArchetype} · Lv.{calculated.Level}",
                "Party Hero",
                "gold",
                "/characters-showcase.jpg",
                $"Active party adventurer exploring the Ruined Chapel in Session 15.",
                $"\"Ready at the table with {calculated.ClassOrArchetype} capabilities.\"",
                "Party Roster · Populated from Character Studio",
                $"/characters?focus={key}",
                "players");

            return Results.Ok(calculated);
        });

        group.MapPost("/campaigns/{campaignId:int}/character-studio/{characterKey}/level-up", (
            int campaignId,
            string characterKey,
            LevelUpCharacterRequest req) =>
        {
            var idx = Sheets.FindIndex(s => s.CharacterKey == characterKey);
            if (idx < 0)
            {
                return Results.NotFound(new { error = $"Character '{characterKey}' not found." });
            }

            var updated = Engine.ApplyLevelUp(
                Sheets[idx],
                req.SelectedFeature,
                req.AbilityIncreaseCode);
            Sheets[idx] = updated;
            return Results.Ok(updated);
        });

        group.MapPost("/campaigns/{campaignId:int}/character-studio/{characterKey}/equipment", (
            int campaignId,
            string characterKey,
            ToggleEquipmentRequest req) =>
        {
            var idx = Sheets.FindIndex(s => s.CharacterKey == characterKey);
            if (idx < 0)
            {
                return Results.NotFound(new { error = $"Character '{characterKey}' not found." });
            }

            var current = Sheets[idx];
            var updatedEq = current.Equipment
                .Select(e => e.Id == req.EquipmentId ? e with { Equipped = req.Equipped } : e)
                .ToList();

            var recalculated = Engine.RecalculateSheet(current with { Equipment = updatedEq });
            Sheets[idx] = recalculated;
            return Results.Ok(recalculated);
        });
    }

    private static List<CharacterSheetDto> SeedInitialSheets()
    {
        var list = new List<CharacterSheetDto>
        {
            new(
                "1:Character:char-dal", "char-dal", 1, "Dallas (Dal)",
                "Edhellain Royal Lineage", "Horizon Ranger / Pattern Scout", "dnd5e",
                7, 34500, 34000, true, 68, 68, 17, 4, 35, 3, "",
                [
                    new("STR", "Strength", 12, 1),
                    new("DEX", "Dexterity", 18, 4),
                    new("CON", "Constitution", 14, 2),
                    new("INT", "Intelligence", 14, 2),
                    new("WIS", "Wisdom", 16, 3),
                    new("CHA", "Charisma", 13, 1),
                ],
                [
                    new("eq-dal-1", "Edhellain Wayfinder Cloak", "Armor", "+2 AC · Silent Step", 2, 0, true),
                    new("eq-dal-2", "Twin Recurve Longbow", "Main Hand", "+2 Attack · 150/600ft", 0, 2, true),
                    new("eq-dal-3", "Cinth Buckler", "Off Hand", "+1 AC when slung", 1, 0, false),
                ],
                ["Pattern Danger Sense", "True Kingship Lineage (Unclaimed)", "Extra Attack"]
            ),
            new(
                "1:Character:char-fivi", "char-fivi", 1, "Fivi",
                "Feywild Outcast", "Fey Trickster & Slingshot Savant", "dnd5e",
                7, 34200, 34000, true, 54, 54, 16, 4, 30, 3, "",
                [
                    new("STR", "Strength", 9, -1),
                    new("DEX", "Dexterity", 18, 4),
                    new("CON", "Constitution", 14, 2),
                    new("INT", "Intelligence", 13, 1),
                    new("WIS", "Wisdom", 12, 1),
                    new("CHA", "Charisma", 17, 3),
                ],
                [
                    new("eq-fivi-1", "Tooth-Loaded Fey Slingshot", "Main Hand", "+3 Crit Precision", 0, 3, true),
                    new("eq-fivi-2", "Dolly (Modified Pocket-Maw)", "Companion", "+2 AC Ward · Non-Lethal Gullet", 2, 1, true),
                ],
                ["Fey Logic Redirection", "Dolly Gullet Containment", "Skyship Claimant"]
            ),
            new(
                "1:Character:char-kildrid", "char-kildrid", 1, "Kildrid",
                "Mountain Dwarf", "Stone & Rune Scholar", "dnd5e",
                7, 34100, 34000, true, 65, 65, 18, 1, 25, 3, "",
                [
                    new("STR", "Strength", 14, 2),
                    new("DEX", "Dexterity", 12, 1),
                    new("CON", "Constitution", 16, 3),
                    new("INT", "Intelligence", 18, 4),
                    new("WIS", "Wisdom", 15, 2),
                    new("CHA", "Charisma", 10, 0),
                ],
                [
                    new("eq-kil-1", "Runed Basalt Half-Plate", "Armor", "+4 AC · Rune Ward", 4, 0, true),
                    new("eq-kil-2", "Anelith Resonance Chisel", "Focus", "+2 Spell Attack / DC", 0, 2, true),
                ],
                ["Deep Stone Tremorsense", "Pre-Moonlight Rune Deciphering", "Abjuration Ward"]
            ),
        };

        return list.Select(s => Engine.RecalculateSheet(s)).ToList();
    }
}
