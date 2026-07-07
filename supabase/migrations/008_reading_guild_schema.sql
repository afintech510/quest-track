-- Migration 008: Reading Guild schema alignment
-- Alters books, book_progress, reading_checkpoints to match spec §2.1
-- Adds reading_streak/last_read_date to kids

-- ============================================================
-- books: add chapter-based fields, genre, lexile
-- ============================================================
ALTER TABLE books ADD COLUMN IF NOT EXISTS genre text NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN IF NOT EXISTS lexile integer NOT NULL DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_chapters integer NOT NULL DEFAULT 10;
ALTER TABLE books ADD COLUMN IF NOT EXISTS checkpoint_chapters jsonb NOT NULL DEFAULT '[]';
ALTER TABLE books ADD COLUMN IF NOT EXISTS chapter_summaries jsonb NOT NULL DEFAULT '{}';
ALTER TABLE books ADD COLUMN IF NOT EXISTS curriculum_connections jsonb NOT NULL DEFAULT '{}';

-- Migrate tier from text ('bronze','silver','gold') to integer (1,2,3)
ALTER TABLE books DROP CONSTRAINT IF EXISTS chk_book_tier;
ALTER TABLE books ALTER COLUMN tier TYPE integer USING
  CASE tier
    WHEN 'bronze' THEN 1
    WHEN 'silver' THEN 2
    WHEN 'gold' THEN 3
    ELSE 1
  END;
ALTER TABLE books ADD CONSTRAINT chk_book_tier CHECK (tier IN (1, 2, 3));

-- ============================================================
-- book_progress: chapter-based, add reflection fields
-- ============================================================
ALTER TABLE book_progress ADD COLUMN IF NOT EXISTS current_chapter integer NOT NULL DEFAULT 0;
ALTER TABLE book_progress ADD COLUMN IF NOT EXISTS star_rating integer;
ALTER TABLE book_progress ADD COLUMN IF NOT EXISTS reflection_text text;

-- Migrate status values
ALTER TABLE book_progress DROP CONSTRAINT IF EXISTS chk_book_status;
UPDATE book_progress SET status = 'reading' WHERE status = 'in_progress';
ALTER TABLE book_progress ADD CONSTRAINT chk_book_status CHECK (status IN ('assigned', 'reading', 'completed'));

-- ============================================================
-- reading_checkpoints: chapter-based quiz model
-- ============================================================
ALTER TABLE reading_checkpoints ADD COLUMN IF NOT EXISTS chapter_number integer NOT NULL DEFAULT 0;
ALTER TABLE reading_checkpoints ADD COLUMN IF NOT EXISTS questions jsonb NOT NULL DEFAULT '[]';
ALTER TABLE reading_checkpoints ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '[]';
ALTER TABLE reading_checkpoints ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;
ALTER TABLE reading_checkpoints ADD COLUMN IF NOT EXISTS xp_awarded integer NOT NULL DEFAULT 0;
ALTER TABLE reading_checkpoints ADD COLUMN IF NOT EXISTS coins_awarded integer NOT NULL DEFAULT 0;
ALTER TABLE reading_checkpoints ADD COLUMN IF NOT EXISTS completed_at timestamptz NOT NULL DEFAULT now();

-- Rename FK column to match spec (progress_id → book_progress_id)
-- Only if progress_id exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reading_checkpoints' AND column_name = 'progress_id'
  ) THEN
    ALTER TABLE reading_checkpoints RENAME COLUMN progress_id TO book_progress_id;
  END IF;
END $$;

-- ============================================================
-- kids: add reading streak fields
-- ============================================================
ALTER TABLE kids ADD COLUMN IF NOT EXISTS last_read_date date;
ALTER TABLE kids ADD COLUMN IF NOT EXISTS reading_streak integer NOT NULL DEFAULT 0;

-- ============================================================
-- Seed 20 books with chapter data
-- ============================================================
DELETE FROM books;

INSERT INTO books (title, author, tier, genre, lexile, page_count, total_chapters, checkpoint_chapters, chapter_summaries, cover_url) VALUES
('The Magic Tree House: Dinosaurs Before Dark', 'Mary Pope Osborne', 1, 'adventure', 240, 68, 10, '[3, 6, 10]',
 '{"3": "Jack and Annie discover a mysterious tree house in the woods filled with books. When Jack points at a dinosaur book and wishes to see real dinosaurs, the tree house starts spinning.", "6": "The siblings explore the prehistoric world, encountering a Pteranodon and a Triceratops. They learn that some dinosaurs are gentle plant-eaters while others are dangerous predators.", "10": "Jack and Annie narrowly escape a T-Rex by climbing back to the tree house. They discover that the magic tree house can take them home by pointing at a picture of Frog Creek woods."}', ''),

('Charlotte''s Web', 'E.B. White', 1, 'fiction', 280, 184, 12, '[4, 8, 12]',
 '{"4": "Wilbur the pig settles into his new home at the Zuckerman barn and meets Charlotte, a grey spider who lives in the doorway above his pen. They become unlikely friends.", "8": "Charlotte weaves the words SOME PIG into her web to save Wilbur from being slaughtered. The whole town comes to see the miracle. Charlotte continues writing messages to keep Wilbur special.", "12": "Charlotte dies after laying her egg sac at the fair, but Wilbur brings her babies home to the barn. Three of Charlotte''s daughters stay and become Wilbur''s friends, continuing the cycle of friendship."}', ''),

('Frog and Toad Are Friends', 'Arnold Lobel', 1, 'fiction', 200, 64, 5, '[2, 5]',
 '{"2": "In ''Spring,'' Frog tries to wake up Toad from his long winter nap. In ''The Story,'' Toad tries to think of a story to tell Frog when he is sick.", "5": "In ''The Letter,'' Toad is sad because he never gets mail. Frog writes him a letter and asks a snail to deliver it. They wait together on the porch, and Toad is overjoyed when it finally arrives."}', ''),

('Mercy Watson to the Rescue', 'Kate DiCamillo', 1, 'humor', 220, 80, 8, '[3, 6, 8]',
 '{"3": "Mr. and Mrs. Watson adore their pet pig Mercy, who loves nothing more than hot buttered toast. One night, Mr. Watson''s bed starts sinking through the floor.", "6": "The fire department arrives as the bedroom floor continues to sag. Mercy, smelling toast from a neighbor''s kitchen, runs next door and accidentally leads everyone to safety.", "8": "The crisis is resolved when the floor is fixed. The neighbors bring toast for everyone, and Mercy is declared a hero — though she was really just following the delicious smell."}', ''),

('Dog Man', 'Dav Pilkey', 1, 'graphic', 210, 240, 10, '[3, 7, 10]',
 '{"3": "A police officer and his dog are injured in an explosion. The doctor combines them into Dog Man — a hero with the body of a man and the head of a dog. Dog Man starts solving crimes.", "7": "Petey the cat, Dog Man''s nemesis, creates an evil plan involving a robot. Dog Man must use his canine instincts and human cleverness to stop Petey before it''s too late.", "10": "Dog Man saves the day and even shows Petey a little kindness. The story ends with Dog Man being the best cop ever, proving that being different can be a superpower."}', ''),

('The One and Only Ivan', 'Katherine Applegate', 2, 'fiction', 320, 305, 14, '[4, 8, 12, 14]',
 '{"4": "Ivan, a silverback gorilla, lives in a cage at the Exit 8 Big Top Mall. He passes time by drawing with crayons and watching TV. His friends include Stella the elephant and a stray dog named Bob.", "8": "A baby elephant named Ruby arrives at the mall, and Stella asks Ivan to protect her. Ivan starts creating special paintings, driven by a promise to find Ruby a better home.", "12": "Ivan paints a picture of a zoo and holds it up for passing cars to see. People start protesting the conditions at the Big Top Mall, and news reporters arrive.", "14": "Ivan and Ruby are moved to a real zoo with grass and sky. Ivan finally feels free, and he knows he kept his promise to Stella. His art is displayed at the zoo for everyone to enjoy."}', ''),

('Wonder', 'R.J. Palacio', 2, 'realistic', 340, 315, 16, '[4, 8, 12, 16]',
 '{"4": "Auggie Pullman was born with severe facial differences and has been homeschooled. At age 10, he starts fifth grade at Beecher Prep. The first days are tough — kids stare and avoid him.", "8": "Auggie makes a true friend in Jack Will, but their friendship is tested when Auggie overhears Jack saying hurtful things. Auggie learns that even friends make mistakes, and Jack works to earn back his trust.", "12": "Through the perspectives of Auggie''s sister Via, her boyfriend Justin, and classmate Miranda, we see how Auggie''s presence changes everyone around him. The school play brings unexpected courage.", "16": "At graduation, Auggie receives the Henry Ward Beecher Medal for being the student whose quiet strength has carried up the most hearts. Everyone stands and cheers, and Auggie finally feels ordinary — in the best way."}', ''),

('Hatchet', 'Gary Paulsen', 2, 'adventure', 360, 195, 12, '[3, 6, 9, 12]',
 '{"3": "Thirteen-year-old Brian is flying to visit his father in Canada when the pilot has a heart attack and dies. Brian crash-lands the small plane in a lake in the Canadian wilderness.", "6": "Using only a hatchet (a gift from his mother), Brian learns to make fire, build a shelter, and find food. He gets sick from eating berries but learns to identify safe ones.", "9": "Brian is attacked by a moose and then hit by a tornado that destroys his shelter. He rebuilds everything, realizing he has changed — he is more patient, observant, and tough.", "12": "Brian retrieves a survival pack from the sunken plane, including a radio transmitter. A pilot picks up the signal and rescues Brian after 54 days alone. He has lost weight but gained wisdom."}', ''),

('Tales of a Fourth Grade Nothing', 'Judy Blume', 2, 'humor', 310, 120, 10, '[3, 7, 10]',
 '{"3": "Peter Hatcher''s biggest problem is his two-year-old brother Fudge, who causes chaos everywhere. Fudge throws tantrums in public, knocks out his front teeth, and embarrasses Peter constantly.", "7": "Peter has to share his room with Fudge when company visits, and Fudge ruins Peter''s school project about transportation. Peter tries to be patient but it keeps getting harder.", "10": "Fudge swallows Peter''s pet turtle Dribble! After a trip to the hospital, Dribble is recovered but doesn''t survive. Peter''s parents finally understand how much Peter puts up with and get him a puppy named Turtle."}', ''),

('The Wild Robot', 'Peter Brown', 2, 'science fiction', 330, 278, 14, '[4, 8, 12, 14]',
 '{"4": "A robot named Roz washes up on a wild island and activates. The animals are terrified of her. She observes nature to learn how to survive, copying animal behaviors and learning their language.", "8": "Roz accidentally crushes a goose nest, leaving one egg. She raises the gosling, Brightbill, as her own. The other animals slowly accept Roz as she helps them through a harsh winter.", "12": "Brightbill learns to fly with the other geese. When combat robots arrive to retrieve Roz, the island animals band together to fight them off, but Roz is badly damaged.", "14": "Roz decides to leave the island to protect her animal family from more robot attacks. Brightbill and the animals say goodbye, hoping she will return one day."}', ''),

('Percy Jackson: The Lightning Thief', 'Rick Riordan', 3, 'fantasy', 380, 375, 18, '[5, 10, 14, 18]',
 '{"5": "Percy Jackson discovers he''s the son of Poseidon, the Greek god of the sea. After being attacked by mythological monsters, he arrives at Camp Half-Blood where demigod kids train.", "10": "Percy sets out on a quest with Annabeth and Grover to find Zeus''s stolen lightning bolt. They face Medusa, the Furies, and Ares along the way, using their demigod powers to survive.", "14": "The trio enters the Underworld to confront Hades, believing he stole the bolt. They discover they''ve been tricked — the real thief planted the bolt in Percy''s backpack to start a war.", "18": "Percy returns the bolt to Zeus on Mount Olympus and prevents a war between the gods. He learns that the real enemy is Kronos, the Titan lord, who is rising from the depths of Tartarus."}', ''),

('A Wrinkle in Time', 'Madeleine L''Engle', 3, 'science fiction', 390, 256, 12, '[3, 6, 9, 12]',
 '{"3": "Meg Murry, her brother Charles Wallace, and friend Calvin meet three mysterious women — Mrs. Whatsit, Mrs. Who, and Mrs. Which — who reveal they can travel through space using a ''tesseract.''", "6": "The children tesser to the planet Camazotz, controlled by an evil force called IT. Everything on the planet is identical and controlled. Charles Wallace is captured by IT''s hypnotic power.", "9": "Meg''s father, a scientist who disappeared while studying tesseracts, is found imprisoned on Camazotz. They rescue him, but Charles Wallace is still under IT''s control. Meg must go back alone.", "12": "Meg returns to Camazotz and defeats IT by focusing on her love for Charles Wallace — the one thing IT cannot understand or replicate. The family is reunited on Earth."}', ''),

('Number the Stars', 'Lois Lowry', 3, 'historical', 370, 137, 12, '[4, 8, 12]',
 '{"4": "In 1943 Copenhagen, ten-year-old Annemarie and her best friend Ellen live under Nazi occupation. When the Nazis begin rounding up Jewish families, Ellen''s family must go into hiding.", "8": "Ellen pretends to be Annemarie''s sister. The family flees to Uncle Henrik''s house near the coast, where a plan is underway to smuggle Jewish families to safety in Sweden by boat.", "12": "Annemarie bravely delivers a special packet to Uncle Henrik''s boat that contains a handkerchief treated with a substance to confuse the Nazi dogs. The Jewish families escape safely to Sweden."}', ''),

('The Phantom Tollbooth', 'Norton Juster', 3, 'fantasy', 400, 256, 14, '[4, 8, 12, 14]',
 '{"4": "Bored Milo finds a mysterious tollbooth in his room. He drives through it and enters the Kingdom of Wisdom, which has been divided into two warring lands: Dictionopolis (words) and Digitopolis (numbers).", "8": "Milo meets the Humbug, Tock the watchdog, and many wordplay characters. He learns that the princesses Rhyme and Reason have been banished, which is why the kingdom is in chaos.", "12": "Milo journeys through the Mountains of Ignorance, facing demons like the Terrible Trivium and the Demon of Insincerity. He reaches the Castle in the Air where the princesses are held.", "14": "Milo rescues Rhyme and Reason and returns them to the Kingdom of Wisdom. Back home, Milo discovers the tollbooth has vanished — but he no longer needs it because the world is full of wonder."}', ''),

('Diary of a Wimpy Kid', 'Jeff Kinney', 1, 'humor', 250, 217, 10, '[3, 7, 10]',
 '{"3": "Greg Heffley starts middle school, determined to become popular. His best friend Rowley is an embarrassing sidekick. Greg tries various schemes to climb the social ladder.", "7": "Greg''s plans keep backfiring — he gets the Cheese Touch, fails at wrestling, and his older brother Rodrick tortures him. His friendship with Rowley is strained by Greg''s selfishness.", "10": "When teenagers bully Rowley, Greg doesn''t stand up for him. Their friendship nearly ends until Greg takes the blame for eating the moldy cheese. He realizes being a good friend matters more than popularity."}', ''),

('Esperanza Rising', 'Pam Muñoz Ryan', 2, 'historical', 350, 262, 14, '[4, 8, 12, 14]',
 '{"4": "Esperanza lives a privileged life on a ranch in Mexico, but when her father is killed and her uncle threatens her family, she and her mother must flee to California.", "8": "In California, Esperanza works in the fields as a migrant farmworker. She must learn to sweep floors, wash clothes, and do things she never had to do before. Her mother falls ill.", "12": "Esperanza organizes and works harder than ever to pay for her mother''s care. She learns the value of hard work and discovers strength she didn''t know she had.", "14": "Mama recovers, and Esperanza''s abuelita finally arrives from Mexico. Esperanza realizes that her family and their love are her true riches, not the wealth she lost."}', ''),

('The Miraculous Journey of Edward Tulane', 'Kate DiCamillo', 2, 'fiction', 300, 228, 12, '[4, 8, 12]',
 '{"4": "Edward Tulane is a china rabbit who belongs to a girl named Abilene. Edward is vain and self-centered. On an ocean voyage, he falls overboard and sinks to the bottom of the sea.", "8": "A fisherman pulls Edward from the ocean. Edward passes through the hands of many owners — a hobo, a farmer, a sick girl named Sarah Ruth — and slowly learns to love and feel.", "12": "Heartbroken after losing Sarah Ruth, Edward ends up in a doll shop. A wise old doll tells him to open his heart. Abilene, now grown up, finds Edward again and takes him home to her daughter."}', ''),

('Holes', 'Louis Sachar', 3, 'adventure', 380, 233, 14, '[4, 8, 12, 14]',
 '{"4": "Stanley Yelnats is sent to Camp Green Lake, a juvenile detention center where boys must dig holes in a dried-up lakebed every day. The warden claims it builds character.", "8": "Stanley befriends Zero, the quietest boy at camp. Stanley teaches Zero to read, and Zero helps Stanley dig. They discover the warden is actually searching for buried treasure.", "12": "Stanley and Zero escape into the desert and find refuge on a mountain. They discover the connection between their families'' pasts and the curse on Stanley''s great-great-grandfather.", "14": "Stanley and Zero return to camp, find the treasure, and are freed. The curse is broken, and Camp Green Lake is shut down. Stanley''s family fortune is restored."}', ''),

('Because of Winn-Dixie', 'Kate DiCamillo', 1, 'fiction', 260, 182, 10, '[3, 6, 10]',
 '{"3": "Ten-year-old Opal moves to a small Florida town with her preacher father. She finds a scruffy dog in a Winn-Dixie supermarket and convinces her dad to let her keep him.", "6": "With Winn-Dixie by her side, Opal makes friends with the town''s quirky residents — Miss Franny the librarian, Gloria Dump, and Otis the guitar-playing pet store worker.", "10": "During a thunderstorm party, Winn-Dixie goes missing. While searching for him, Opal realizes that her new community is her family now. Winn-Dixie is found safe, and everyone celebrates together."}', ''),

('Bud, Not Buddy', 'Christopher Paul Curtis', 3, 'historical', 370, 245, 14, '[4, 8, 12, 14]',
 '{"4": "It''s 1936 during the Great Depression. Ten-year-old Bud escapes a cruel foster home in Flint, Michigan, carrying a suitcase with flyers from a jazz band. He believes the bandleader is his father.", "8": "Bud walks and hitchhikes to Grand Rapids to find Herman E. Calloway and his band. Along the way he follows his ''Rules and Things for Having a Funner Life.''", "12": "Bud finds the band and insists Herman is his father. The band members are kind, but Herman is grumpy and denies it. Evidence from Bud''s suitcase starts to reveal the truth.", "14": "Bud discovers that Herman is actually his grandfather, not his father — his mother was Herman''s daughter who ran away. Herman breaks down crying, and Bud finally has a real family."}', '');

-- ============================================================
-- complete_checkpoint RPC
-- ============================================================
CREATE OR REPLACE FUNCTION complete_checkpoint(
  p_book_progress_id uuid,
  p_chapter_number integer,
  p_questions jsonb,
  p_answers jsonb,
  p_score integer,
  p_max_score integer,
  p_mutation_id uuid
) RETURNS json AS $$
DECLARE
  v_bp book_progress%ROWTYPE;
  v_kid kids%ROWTYPE;
  v_daily_cap CONSTANT int := 200;
  v_base_xp int;
  v_base_coins int;
  v_xp_to_award int;
  v_leveled_up boolean := false;
  v_new_level int;
BEGIN
  IF EXISTS (SELECT 1 FROM processed_mutations WHERE mutation_id = p_mutation_id) THEN
    RETURN json_build_object('status', 'already_processed');
  END IF;

  SELECT * INTO v_bp FROM book_progress WHERE id = p_book_progress_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_kid FROM kids WHERE id = v_bp.kid_id FOR UPDATE;

  v_base_xp := p_score * 10;
  v_base_coins := p_score * 5;
  v_xp_to_award := LEAST(v_base_xp, v_daily_cap - v_kid.daily_xp);
  IF v_xp_to_award < 0 THEN v_xp_to_award := 0; END IF;

  INSERT INTO reading_checkpoints (book_progress_id, chapter_number, questions, answers, score, xp_awarded, coins_awarded, completed_at)
  VALUES (p_book_progress_id, p_chapter_number, p_questions, p_answers, p_score, v_xp_to_award, v_base_coins, now());

  UPDATE kids SET
    coins = coins + v_base_coins,
    xp = xp + v_xp_to_award,
    daily_xp = daily_xp + v_xp_to_award
  WHERE id = v_kid.id;

  INSERT INTO processed_mutations (mutation_id, processed_at) VALUES (p_mutation_id, now());

  SELECT * INTO v_kid FROM kids WHERE id = v_kid.id;
  IF v_kid.xp >= v_kid.level * 100 THEN
    v_new_level := v_kid.level + 1;
    UPDATE kids SET level = v_new_level, xp = v_kid.xp - (v_kid.level * 100) WHERE id = v_kid.id;
    v_leveled_up := true;
  END IF;

  RETURN json_build_object(
    'status', 'success',
    'xp_awarded', v_xp_to_award,
    'coins_awarded', v_base_coins,
    'leveled_up', v_leveled_up,
    'level', COALESCE(v_new_level, v_kid.level)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- complete_book RPC
-- ============================================================
CREATE OR REPLACE FUNCTION complete_book(
  p_book_progress_id uuid,
  p_mutation_id uuid
) RETURNS json AS $$
DECLARE
  v_bp book_progress%ROWTYPE;
  v_book books%ROWTYPE;
  v_kid kids%ROWTYPE;
  v_daily_cap CONSTANT int := 200;
  v_xp_to_award int;
  v_leveled_up boolean := false;
  v_new_level int;
BEGIN
  IF EXISTS (SELECT 1 FROM processed_mutations WHERE mutation_id = p_mutation_id) THEN
    RETURN json_build_object('status', 'already_processed');
  END IF;

  SELECT * INTO v_bp FROM book_progress WHERE id = p_book_progress_id FOR UPDATE;
  IF NOT FOUND OR v_bp.status = 'completed' THEN
    RETURN json_build_object('status', 'invalid_state');
  END IF;

  SELECT * INTO v_book FROM books WHERE id = v_bp.book_id;
  SELECT * INTO v_kid FROM kids WHERE id = v_bp.kid_id FOR UPDATE;

  v_xp_to_award := LEAST(v_book.xp_reward, v_daily_cap - v_kid.daily_xp);
  IF v_xp_to_award < 0 THEN v_xp_to_award := 0; END IF;

  UPDATE book_progress SET status = 'completed', completed_at = now()
  WHERE id = p_book_progress_id;

  UPDATE kids SET
    coins = coins + v_book.coin_reward,
    xp = xp + v_xp_to_award,
    daily_xp = daily_xp + v_xp_to_award
  WHERE id = v_kid.id;

  INSERT INTO processed_mutations (mutation_id, processed_at) VALUES (p_mutation_id, now());

  SELECT * INTO v_kid FROM kids WHERE id = v_kid.id;
  IF v_kid.xp >= v_kid.level * 100 THEN
    v_new_level := v_kid.level + 1;
    UPDATE kids SET level = v_new_level, xp = v_kid.xp - (v_kid.level * 100) WHERE id = v_kid.id;
    v_leveled_up := true;
  END IF;

  RETURN json_build_object(
    'status', 'success',
    'xp_awarded', v_xp_to_award,
    'coins_awarded', v_book.coin_reward,
    'leveled_up', v_leveled_up,
    'level', COALESCE(v_new_level, v_kid.level)
  );
END;
$$ LANGUAGE plpgsql;

-- Update kid_analytics view
CREATE OR REPLACE VIEW kid_analytics AS
SELECT
  k.id AS kid_id,
  k.name,
  k.xp,
  k.coins,
  k.level,
  k.streak_days,
  k.reading_streak,
  (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.kid_id = k.id) AS total_quizzes,
  (SELECT COUNT(*) FROM book_progress bp WHERE bp.kid_id = k.id AND bp.status = 'completed') AS books_completed,
  (SELECT COUNT(*) FROM chore_events ce WHERE ce.kid_id = k.id AND ce.status = 'approved') AS chores_approved
FROM kids k;
