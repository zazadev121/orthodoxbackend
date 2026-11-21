import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalAnswerNames,selectedAnswer,retrieve} from '../src/sources.js';
test('Sorani AI uses the requested name including inflection without rewriting stored evidence',()=>{
 assert.equal(canonicalAnswerNames('عیسا، عیسای مەسیح. عيسى! عیسی','ckb'),'یەشوا، یەشوای مەسیح. یەشوا! یەشوا');
 assert.equal(canonicalAnswerNames('عیسا','en'),'عیسا');
 const source={id:'source-1',title:'Scripture',publisher:'OCA',url:'https://www.oca.org/orthodoxy',content:'About Jesus Christ.',content_ckb:'عیسا پەروەردگارە.',keywords:'عیسا مەسیح'};
 const result=selectedAnswer({sourceIds:[source.id]},[source],'ckb');
 assert.ok(result.answer.includes('یەشوا'));assert.ok(!result.answer.includes('عیسا'));assert.equal(source.content_ckb,'عیسا پەروەردگارە.');
 assert.equal(retrieve('یەشوا',[source]).length,1);
});
