begin;

-- Align the seeded database catalog with the native movement key. This keeps
-- historical Warrior II mastery and the Tree Pose prerequisite on one key.
update exercise_definitions
   set exercise_key = 'warrior_ii'
 where exercise_key = 'warrior_two';

update lessons
   set required_mastery_keys = array_replace(required_mastery_keys, 'warrior_two', 'warrior_ii')
 where 'warrior_two' = any(required_mastery_keys);

update skill_mastery
   set exercise_key = 'warrior_ii'
 where exercise_key = 'warrior_two'
   and not exists (
     select 1 from skill_mastery current_key
      where current_key.user_id = skill_mastery.user_id
        and current_key.exercise_key = 'warrior_ii'
   );

delete from skill_mastery legacy
 where legacy.exercise_key = 'warrior_two'
   and exists (
     select 1 from skill_mastery current_key
      where current_key.user_id = legacy.user_id
        and current_key.exercise_key = 'warrior_ii'
   );

commit;
