-- MySQL 8; run the WHOLE file in one fresh connection on iw_mixes.
-- SELECT only for business data; no data or schema changes.
-- Stop on errors, ROLLBACK, then close the dedicated connection.
SELECT 'P30_SESSION_BEFORE' check_id,DATABASE() target_database,CONNECTION_ID() connection_id,
 @@session.transaction_read_only session_read_only,@@autocommit autocommit;
SET SESSION TRANSACTION READ ONLY;
START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;
SELECT 'P30_SESSION_READY' check_id,DATABASE() target_database,CONNECTION_ID() connection_id,
 @@session.transaction_read_only session_read_only,@@autocommit autocommit;

WITH drift AS (
 SELECT r.id detail_id,r.outfit_id,r.item_id,r.user_id detail_owner_id,
 h.user_id head_owner_id,i.user_id current_item_owner_id,
 r.category historical_category_code,r.item_style historical_style_code,
 i.category current_category_code,i.item_style current_style_code,
 h.deleted head_deleted,i.deleted item_deleted
 FROM wardrobe_outfit_item r
 JOIN wardrobe_outfit h ON h.id=r.outfit_id
 JOIN wardrobe_item i ON i.id=r.item_id
 WHERE r.deleted=0 AND i.user_id<>r.user_id
 ORDER BY r.id LIMIT 20
), refs AS (
 SELECT drift.*,5002 dict_type,historical_category_code historical_code FROM drift
 UNION ALL
 SELECT drift.*,5006,historical_style_code FROM drift
), keys_by_owner AS (
 SELECT user_id,dict_type,dict_code,COUNT(*) candidate_count,
 MIN(id) candidate_id
 FROM base_dict
 WHERE scope_type=0 AND family_group_id=0 AND deleted=0 AND dict_type IN (5002,5006)
 GROUP BY user_id,dict_type,dict_code
)
SELECT /*+ MAX_EXECUTION_TIME(10000) */ 'P31_HISTORY_OWNER_SOURCES' check_id,
 r.detail_id,r.outfit_id,r.item_id,r.detail_owner_id,r.head_owner_id,r.current_item_owner_id,
 r.head_deleted,r.item_deleted,r.historical_category_code,r.historical_style_code,
 r.current_category_code,r.current_style_code,r.dict_type,r.historical_code,
 COALESCE(old_key.candidate_count,0) detail_owner_candidates,
 old_source.id detail_owner_source_id,
 COALESCE(new_key.candidate_count,0) current_item_owner_candidates,
 new_source.id current_item_owner_source_id,
 CASE WHEN old_source.id IS NOT NULL AND new_source.id IS NOT NULL
 THEN CONVERT(old_source.dict_name USING binary)=CONVERT(new_source.dict_name USING binary)
 ELSE NULL END same_name_for_historical_code
FROM refs r
LEFT JOIN keys_by_owner old_key ON old_key.user_id=r.detail_owner_id
 AND old_key.dict_type=r.dict_type AND old_key.dict_code=r.historical_code
LEFT JOIN base_dict old_source ON old_key.candidate_count=1 AND old_source.id=old_key.candidate_id
LEFT JOIN keys_by_owner new_key ON new_key.user_id=r.current_item_owner_id
 AND new_key.dict_type=r.dict_type AND new_key.dict_code=r.historical_code
LEFT JOIN base_dict new_source ON new_key.candidate_count=1 AND new_source.id=new_key.candidate_id
ORDER BY r.detail_id,r.dict_type;

SELECT 'P32_SESSION_END' check_id,DATABASE() target_database,CONNECTION_ID() connection_id,
 @@session.transaction_read_only session_read_only;
ROLLBACK;
