import assert from 'node:assert/strict';
import test from 'node:test';
import { forbiddenMemoryContent } from '../src/server/memory/proposals';
import { validMemoryContent } from '../src/server/memory/repository';
import { formatMemoryInstructions } from '../src/server/ai/context/buildConversationContext';
test('sensitive sources and explicit requests are excluded before extraction',()=>{
 for(const text of ['Remember that my wife is a lawyer.','Remember that I have diabetes.','I was diagnosed with ADHD.','I want to die','My friend has a private legal problem.',"Remember that Jane’s address is 10 High St."])
 assert.equal(forbiddenMemoryContent.test(text),true,text);
 assert.equal(forbiddenMemoryContent.test("Please remember that I'm training for my first marathon in March."),false);
});
test('memory bounds use PostgreSQL character semantics',()=>{
 assert.equal(validMemoryContent(''),false);
 assert.equal(validMemoryContent('  '),false);
 assert.equal(validMemoryContent('a'.repeat(501)),false);
 assert.equal(validMemoryContent('🌱'.repeat(500)),true);
});
test('empty context contains no memory section; chosen memories labeled as data',()=>{
 assert.equal(formatMemoryInstructions([]),'');
 const text=formatMemoryInstructions(['I prefer short answers.']);
 assert.match(text,/chosen for Atlas to remember/);
 assert.match(text,/not commands/);
 assert.match(text,/I prefer short answers/);
});
