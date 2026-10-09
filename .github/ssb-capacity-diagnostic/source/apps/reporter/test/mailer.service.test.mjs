import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import * as shared from 'nodemailer/lib/shared';
import { MailerService } from '../src/services/mailer.service.ts';
import isolation from '../../../test/helpers/mail-network-isolation.cjs';

isolation.registerMailerTests(test, {
  name: 'MailerService (reporter ESM)', nodemailer, shared,
  send: message => new MailerService().send(message),
  checkFailure(error, failure) { assert.equal(error, failure); },
});
