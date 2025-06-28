SELECT DISTINCT
    C.GRPID AS 'grpId',
    L.loc AS 'name',
    C.EXPANSIONCODE AS 'set'
FROM
    CARDS AS C
    LEFT JOIN Localizations_enUS AS L
        ON C.TITLEID = L.LOCID
WHERE
    L.loc NOT LIKE '%<%'