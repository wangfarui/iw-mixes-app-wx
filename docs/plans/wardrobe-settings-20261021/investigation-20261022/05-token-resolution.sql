-- Read-only token resolution including legacy English tokens and mixed CSV.
WITH fields AS (
 SELECT 'ITEM' kind,id row_id,user_id,deleted,5004 dict_type,scene_tags tags FROM wardrobe_item
 UNION ALL SELECT 'ITEM',id,user_id,deleted,5005,style_tags FROM wardrobe_item
 UNION ALL SELECT 'OUTFIT',id,user_id,deleted,5004,scene_tags FROM wardrobe_outfit
 UNION ALL SELECT 'OUTFIT',id,user_id,deleted,5005,style_tags FROM wardrobe_outfit
 UNION ALL SELECT 'RECORD',id,user_id,deleted,5004,scene_tags FROM wardrobe_wear_record
), tokens AS (
 SELECT f.*,TRIM(j.token) token FROM fields f JOIN JSON_TABLE(CONCAT('[',REPLACE(JSON_QUOTE(tags),',','","'),']'),'$[*]' COLUMNS(token VARCHAR(128) PATH '$')) j WHERE TRIM(j.token)<>''
), mapped AS (
 SELECT t.*,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=t.user_id AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=t.dict_type AND d.dict_code=CAST(IF(REGEXP_LIKE(token,'^[0-9]+$'),token,'0') AS UNSIGNED) AND d.deleted=0) current_sources,
 (SELECT COUNT(*) FROM base_dict d WHERE d.user_id=t.user_id AND d.scope_type=0 AND d.family_group_id=0 AND d.dict_type=t.dict_type AND d.dict_code=CAST(IF(REGEXP_LIKE(token,'^[0-9]+$'),token,'0') AS UNSIGNED)) all_sources
 FROM tokens t
)
SELECT 'all_tokens' section,kind,dict_type,deleted,COUNT(*) token_count,
 SUM(REGEXP_LIKE(token,'^[0-9]+$')) numeric_tokens,
 SUM(REGEXP_LIKE(token,'^[0-9]+$') AND current_sources=1) numeric_current_unique,
 SUM(REGEXP_LIKE(token,'^[0-9]+$') AND current_sources=0 AND all_sources=1) numeric_deleted_unique,
 SUM(REGEXP_LIKE(token,'^[0-9]+$') AND all_sources=0) numeric_unknown,
 SUM(NOT REGEXP_LIKE(token,'^[0-9]+$')) literal_tokens,
 SUM(NOT REGEXP_LIKE(token,'^[0-9]+$') AND token NOT IN ('work','daily','travel','home','simple','smart','casual','street')) literal_without_known_alias
FROM mapped GROUP BY kind,dict_type,deleted ORDER BY kind,dict_type,deleted;
WITH fields AS (
 SELECT 'ITEM' kind,id row_id,deleted,scene_tags tags FROM wardrobe_item
 UNION ALL SELECT 'ITEM',id,deleted,style_tags FROM wardrobe_item
 UNION ALL SELECT 'OUTFIT',id,deleted,scene_tags FROM wardrobe_outfit
 UNION ALL SELECT 'OUTFIT',id,deleted,style_tags FROM wardrobe_outfit
 UNION ALL SELECT 'RECORD',id,deleted,scene_tags FROM wardrobe_wear_record
)
SELECT 'legacy_affected_records' section,kind,deleted,COUNT(DISTINCT row_id) record_count,COUNT(*) field_count
FROM fields WHERE tags<>'' AND NOT REGEXP_LIKE(tags,'^[0-9]+(,[0-9]+)*$') GROUP BY kind,deleted ORDER BY kind,deleted;
SELECT 'user_counts' section,COUNT(*) total,SUM(deleted=0) not_deleted FROM auth_user;
SELECT 'dictionary_mutation_evidence' section,COUNT(*) dict_rows,SUM(update_time>create_time) rows_with_later_change
FROM base_dict WHERE dict_type IN (5002,5003,5004,5005,5006);
SELECT 'current_relation_owner_drift' section,'OUTFIT_ITEM' kind,COUNT(*) rows_count,SUM(i.deleted=1) item_deleted,SUM(i.user_id<>r.user_id) owner_differs
FROM wardrobe_outfit_item r LEFT JOIN wardrobe_item i ON i.id=r.item_id WHERE r.deleted=0
UNION ALL SELECT 'current_relation_owner_drift','RECORD_ITEM',COUNT(*),SUM(i.deleted=1),SUM(i.user_id<>r.user_id)
FROM wardrobe_wear_record_item r LEFT JOIN wardrobe_item i ON i.id=r.item_id WHERE r.deleted=0;
