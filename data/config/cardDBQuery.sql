SELECT DISTINCT
    c.GrpId AS "grpId",
    l.loc AS "name",
    c.ExpansionCode AS "set"
FROM
    Cards AS c
    INNER JOIN Localizations_enUS AS l ON c.TitleId = l.LocId
WHERE
    l.loc NOT LIKE '%<%'